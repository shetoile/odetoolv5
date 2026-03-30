use std::fs;
use std::path::Path;

fn looks_like_numbered_outline_line(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return false;
    }

    let bytes = trimmed.as_bytes();
    let len = bytes.len();
    let mut idx = 0usize;
    let mut digit_count = 0usize;

    while idx < len && bytes[idx].is_ascii_digit() {
        digit_count += 1;
        idx += 1;
    }
    if digit_count == 0 {
        return false;
    }

    while idx < len {
        if bytes[idx] == b'.' || bytes[idx] == b'-' {
            idx += 1;
            let segment_start = idx;
            while idx < len && bytes[idx].is_ascii_digit() {
                idx += 1;
            }
            if idx == segment_start {
                idx -= 1;
                break;
            }
            continue;
        }
        break;
    }

    while idx < len && bytes[idx].is_ascii_whitespace() {
        idx += 1;
    }

    idx < len
}

fn normalize_excel_sheet_key(text: &str) -> String {
    text.lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .to_lowercase()
}

pub async fn parse_file(path: &Path, extension: &str) -> Option<String> {
    match extension.to_lowercase().as_str() {
        "pdf" => parse_pdf(path).await,
        "docx" => parse_docx(path).await,
        "xlsx" | "xls" => parse_excel(path).await,
        "txt" | "md" | "csv" => fs::read_to_string(path).ok(),
        _ => None,
    }
}

async fn parse_pdf(path: &Path) -> Option<String> {
    // Attempt standard PDF text extraction
    tokio::task::spawn_blocking({
        let p = path.to_path_buf();
        move || pdf_extract::extract_text(p).ok()
    })
    .await
    .unwrap_or(None)
}

async fn parse_docx(path: &Path) -> Option<String> {
    tokio::task::spawn_blocking({
        let p = path.to_path_buf();
        move || -> Option<String> {
            let file = fs::File::open(p).ok()?;
            let mut archive = zip::ZipArchive::new(file).ok()?;
            let mut document_xml = archive.by_name("word/document.xml").ok()?;
            let mut xml_content = String::new();
            use std::io::Read;
            document_xml.read_to_string(&mut xml_content).ok()?;

            // Extract plain text from quick-xml
            use quick_xml::events::Event;
            use quick_xml::Reader;

            let mut reader = Reader::from_str(&xml_content);
            reader.config_mut().trim_text(true);

            let mut text = String::new();
            let mut buf = Vec::new();

            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(Event::Text(e)) => {
                        let unescaped = e.unescape().unwrap_or_default();
                        let fragment = unescaped.trim();
                        if !fragment.is_empty() {
                            if matches!(text.chars().last(), Some(ch) if !ch.is_whitespace()) {
                                text.push(' ');
                            }
                            text.push_str(fragment);
                        }
                    }
                    Ok(Event::End(e)) => {
                        let name = e.name();
                        if name.as_ref() == b"w:p" || name.as_ref() == b"w:tr" {
                            if !text.ends_with('\n') {
                                text.push('\n');
                            }
                        } else if name.as_ref() == b"w:tc"
                            && !matches!(text.chars().last(), Some('\n' | '\t'))
                        {
                            text.push('\t');
                        }
                    }
                    Ok(Event::Empty(e)) => {
                        let name = e.name();
                        if name.as_ref() == b"w:br" || name.as_ref() == b"w:cr" {
                            if !text.ends_with('\n') {
                                text.push('\n');
                            }
                        } else if name.as_ref() == b"w:tab"
                            && !matches!(text.chars().last(), Some('\n' | '\t'))
                        {
                            text.push('\t');
                        }
                    }
                    Ok(Event::Eof) => break,
                    Err(_) => break,
                    _ => (),
                }
                buf.clear();
            }
            let normalized = text
                .lines()
                .map(str::trim)
                .collect::<Vec<_>>()
                .join("\n")
                .trim()
                .to_string();
            Some(normalized)
        }
    })
    .await
    .unwrap_or(None)
}

async fn parse_excel(path: &Path) -> Option<String> {
    tokio::task::spawn_blocking({
        let p = path.to_path_buf();
        move || -> Option<String> {
            use calamine::{open_workbook_auto, Reader};
            use std::collections::HashSet;
            let mut workbook = match open_workbook_auto(&p) {
                Ok(w) => w,
                Err(err) => {
                    eprintln!("failed to open excel at {:?}: {}", p, err);
                    return None;
                }
            };
            let worksheets = workbook.sheet_names().to_owned();
            let mut unique_sheet_keys: HashSet<String> = HashSet::new();
            let mut unique_sheet_texts: Vec<String> = Vec::new();
            let mut best_outline_sheet: Option<(usize, usize, String)> = None;

            for sheet_name in worksheets {
                if let Some(Ok(range)) = workbook.worksheet_range(&sheet_name) {
                    let mut lines: Vec<String> = Vec::new();
                    for row in range.rows() {
                        let cells = row
                            .iter()
                            .map(|cell| cell.to_string())
                            .map(|value| value.trim().to_string())
                            .filter(|value| !value.is_empty())
                            .collect::<Vec<_>>();
                        if cells.is_empty() {
                            continue;
                        }
                        // Preserve worksheet columns so the frontend can distinguish title,
                        // description, and deliverable-like cells instead of flattening them.
                        lines.push(cells.join(" | "));
                    }

                    if lines.is_empty() {
                        continue;
                    }

                    let sheet_text = lines.join("\n").trim().to_string();
                    if sheet_text.is_empty() {
                        continue;
                    }

                    let normalized_key = normalize_excel_sheet_key(&sheet_text);
                    if unique_sheet_keys.insert(normalized_key) {
                        unique_sheet_texts.push(sheet_text.clone());
                    }

                    let outline_count = lines
                        .iter()
                        .filter(|line| looks_like_numbered_outline_line(line))
                        .count();
                    if outline_count >= 6 {
                        let line_count = lines.len();
                        let should_replace = match &best_outline_sheet {
                            Some((best_outline_count, best_line_count, _)) => {
                                outline_count > *best_outline_count
                                    || (outline_count == *best_outline_count
                                        && line_count > *best_line_count)
                            }
                            None => true,
                        };
                        if should_replace {
                            best_outline_sheet = Some((outline_count, line_count, sheet_text));
                        }
                    }
                } else {
                    eprintln!("failed to read worksheet range for sheet: {}", sheet_name);
                }
            }

            if let Some((_, _, sheet_text)) = best_outline_sheet {
                return Some(sheet_text);
            }

            if unique_sheet_texts.is_empty() {
                None
            } else {
                Some(unique_sheet_texts.join("\n\n"))
            }
        }
    })
    .await
    .unwrap_or(None)
}

#[cfg(test)]
mod tests {
    use super::parse_file;
    use std::fs;
    use std::path::PathBuf;

    fn build_temp_path(file_name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "odetool-document-parser-{}-{}",
            std::process::id(),
            file_name
        ));
        path
    }

    #[test]
    fn parse_file_reads_plain_text_files() {
        let path = build_temp_path("plain-text.txt");
        fs::write(&path, "Line 1\nLine 2").expect("write temp txt");
        let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
        let parsed = runtime
            .block_on(parse_file(&path, "txt"))
            .expect("txt content");
        fs::remove_file(&path).ok();
        assert_eq!(parsed, "Line 1\nLine 2");
    }

    #[test]
    fn parse_file_keeps_empty_text_files_readable() {
        let path = build_temp_path("empty-text.txt");
        fs::write(&path, "").expect("write empty txt");
        let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
        let parsed = runtime
            .block_on(parse_file(&path, "txt"))
            .expect("empty txt content");
        fs::remove_file(&path).ok();
        assert_eq!(parsed, "");
    }
}
