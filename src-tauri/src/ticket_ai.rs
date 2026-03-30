use serde::Serialize;

#[derive(Serialize)]
pub struct TicketAnalysis {
    pub category: String,
    pub sentiment: String,
    pub priority: String,
    pub suggestion: String,
}

pub fn build_ticket_analysis_prompt(content: &str) -> String {
    format!(
        "Analyze the following customer support ticket and provide a JSON response with 'category', 'sentiment', 'priority' (Low, Medium, High, Urgent), and a brief 'suggestion' for next steps.\n\nTicket Content:\n{}\n\nJSON Response:",
        content
    )
}

pub fn build_ticket_response_prompt(content: &str, instructions: &str) -> String {
    format!(
        "Draft a professional and empathetic response to the following customer support ticket. \n\nAdditional Instructions: {}\n\nTicket Content:\n{}\n\nDraft Response:",
        instructions, content
    )
}
