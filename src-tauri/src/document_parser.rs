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
        "html" | "htm" => parse_html(path).await,
        "txt" | "md" | "csv" => parse_plain_text(path).await,
        _ => None,
    }
}

fn decode_text_bytes_lossy(bytes: &[u8]) -> String {
    let utf8_bom = [0xEF, 0xBB, 0xBF];
    let utf16_le_bom = [0xFF, 0xFE];
    let utf16_be_bom = [0xFE, 0xFF];

    if bytes.starts_with(&utf16_le_bom) {
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&units);
    }

    if bytes.starts_with(&utf16_be_bom) {
        let units = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16_lossy(&units);
    }

    let payload = if bytes.starts_with(&utf8_bom) {
        &bytes[utf8_bom.len()..]
    } else {
        bytes
    };
    String::from_utf8_lossy(payload).into_owned()
}

pub fn strip_html_to_text(input: &str) -> String {
    let mut text = String::with_capacity(input.len());
    let mut inside_tag = false;
    let mut previous_was_space = false;
    let mut previous_was_newline = false;
    let mut tag_buffer = String::new();
    let mut skip_until_tag: Option<&'static str> = None;

    for ch in input.chars() {
        if inside_tag {
            if ch == '>' {
                let tag = tag_buffer.trim().to_ascii_lowercase();
                let tag_name = tag
                    .trim_start_matches('/')
                    .split_whitespace()
                    .next()
                    .unwrap_or("");

                if let Some(skip_tag) = skip_until_tag {
                    if tag.starts_with('/') && tag_name == skip_tag {
                        skip_until_tag = None;
                    }
                } else if tag_name == "script" || tag_name == "style" {
                    if !tag.starts_with('/') {
                        skip_until_tag = Some(if tag_name == "script" { "script" } else { "style" });
                    }
                } else if matches!(
                    tag_name,
                    "p" | "div" | "section" | "article" | "li" | "tr" | "td" | "th" | "br" | "h1"
                        | "h2" | "h3" | "h4" | "h5" | "h6"
                ) {
                    if !text.ends_with('\n') {
                        text.push('\n');
                        previous_was_newline = true;
                        previous_was_space = false;
                    }
                }
                tag_buffer.clear();
                inside_tag = false;
            } else {
                tag_buffer.push(ch);
            }
            continue;
        }

        if ch == '<' {
            inside_tag = true;
            tag_buffer.clear();
            continue;
        }

        if skip_until_tag.is_some() {
            continue;
        }

        let normalized = match ch {
            '\r' => continue,
            '\n' | '\t' => ' ',
            _ => ch,
        };

        if normalized.is_whitespace() {
            if previous_was_space || previous_was_newline {
                continue;
            }
            text.push(' ');
            previous_was_space = true;
            continue;
        }

        text.push(normalized);
        previous_was_space = false;
        previous_was_newline = false;
    }

    text.split('\n')
        .map(|line| {
            line.replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ")
        })
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

async fn parse_html(path: &Path) -> Option<String> {
    tokio::task::spawn_blocking({
        let p = path.to_path_buf();
        move || {
            fs::read(p)
                .ok()
                .map(|bytes| strip_html_to_text(&decode_text_bytes_lossy(&bytes)))
        }
    })
    .await
    .unwrap_or(None)
}

async fn parse_plain_text(path: &Path) -> Option<String> {
    tokio::task::spawn_blocking({
        let p = path.to_path_buf();
        move || fs::read(p).ok().map(|bytes| decode_text_bytes_lossy(&bytes))
    })
    .await
    .unwrap_or(None)
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

    #[test]
    fn parse_file_reads_html_files_as_text() {
        let path = build_temp_path("page.html");
        fs::write(
            &path,
            "<html><body><h1>Project Sheet</h1><p>Hello <strong>team</strong></p><script>ignored()</script></body></html>",
        )
        .expect("write html");
        let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
        let parsed = runtime
            .block_on(parse_file(&path, "html"))
            .expect("html content");
        fs::remove_file(&path).ok();
        assert_eq!(parsed, "Project Sheet\nHello team");
    }
}
