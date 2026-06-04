use std::sync::{Mutex, OnceLock};

use harper_core::{
    Dialect, Document,
    linting::{LintGroup, LintKind, Linter, Suggestion},
    spell::FstDictionary,
};

static LINTER: OnceLock<Mutex<LintGroup>> = OnceLock::new();

#[derive(serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SuggestionKind {
    Replace,
    Remove,
    InsertAfter,
}

#[derive(serde::Serialize)]
pub struct GrammarSuggestion {
    pub kind: SuggestionKind,
    pub text: String,
}

#[derive(serde::Serialize)]
pub struct GrammarProblem {
    pub start: usize,
    pub end: usize,
    pub message: String,
    pub kind: String,
    pub suggestions: Vec<GrammarSuggestion>,
}

fn lint_kind_to_bucket(kind: &LintKind) -> &'static str {
    use harper_core::linting::LintKind::*;
    match kind {
        Spelling | Typo => "spelling",
        Style | Readability | Redundancy | Repetition | WordChoice | Enhancement | Regionalism => {
            "style"
        }
        _ => "grammar",
    }
}

fn map_suggestion(s: Suggestion) -> GrammarSuggestion {
    match s {
        Suggestion::ReplaceWith(chars) => GrammarSuggestion {
            kind: SuggestionKind::Replace,
            text: chars.iter().collect(),
        },
        Suggestion::InsertAfter(chars) => GrammarSuggestion {
            kind: SuggestionKind::InsertAfter,
            text: chars.iter().collect(),
        },
        Suggestion::Remove => GrammarSuggestion {
            kind: SuggestionKind::Remove,
            text: String::new(),
        },
    }
}

#[tauri::command]
pub async fn lint_text(text: String) -> Result<Vec<GrammarProblem>, String> {
    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

    let linter = LINTER.get_or_init(|| {
        Mutex::new(LintGroup::new_curated(
            FstDictionary::curated(),
            Dialect::American,
        ))
    });

    let doc = Document::new_plain_english_curated(&text);

    let mut guard = linter.lock().map_err(|e| e.to_string())?;
    let lints = guard.lint(&doc);

    let problems = lints
        .into_iter()
        .map(|lint| GrammarProblem {
            start: lint.span.start,
            end: lint.span.end,
            message: lint.message.clone(),
            kind: lint_kind_to_bucket(&lint.lint_kind).to_string(),
            suggestions: lint
                .suggestions
                .into_iter()
                .map(map_suggestion)
                .collect(),
        })
        .collect();

    Ok(problems)
}

#[cfg(test)]
mod tests {
    use harper_core::{Dialect, Document, linting::{LintGroup, Linter}, spell::FstDictionary};

    #[test]
    fn t4_lint_group_flags_subject_verb_error() {
        let mut linter =
            LintGroup::new_curated(FstDictionary::curated(), Dialect::American);
        let doc = Document::new_plain_english_curated("He go to the store.");
        let lints = linter.lint(&doc);
        assert!(
            !lints.is_empty(),
            "expected at least one lint on 'He go to the store.' but got none"
        );
    }
}
