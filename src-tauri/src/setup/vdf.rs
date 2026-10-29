//! Minimal parser for Valve's KeyValues text format (enough for libraryfolders.vdf).

#[derive(Debug, Clone, PartialEq)]
pub enum Vdf {
    Str(String),
    Obj(Vec<(String, Vdf)>),
}

impl Vdf {
    pub fn get(&self, key: &str) -> Option<&Vdf> {
        match self {
            Vdf::Obj(entries) => entries
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key))
                .map(|(_, v)| v),
            Vdf::Str(_) => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Vdf::Str(s) => Some(s),
            Vdf::Obj(_) => None,
        }
    }

    pub fn entries(&self) -> &[(String, Vdf)] {
        match self {
            Vdf::Obj(entries) => entries,
            Vdf::Str(_) => &[],
        }
    }
}

#[derive(Debug, PartialEq)]
enum Token {
    Str(String),
    Open,
    Close,
}

fn tokenize(src: &str) -> Result<Vec<Token>, String> {
    let mut out = Vec::new();
    let mut chars = src.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '{' => out.push(Token::Open),
            '}' => out.push(Token::Close),
            '"' => {
                let mut s = String::new();
                loop {
                    match chars.next() {
                        Some('\\') => match chars.next() {
                            Some('n') => s.push('\n'),
                            Some('t') => s.push('\t'),
                            Some(other) => s.push(other),
                            None => return Err("unterminated escape".into()),
                        },
                        Some('"') => break,
                        Some(ch) => s.push(ch),
                        None => return Err("unterminated string".into()),
                    }
                }
                out.push(Token::Str(s));
            }
            '/' if chars.peek() == Some(&'/') => {
                for ch in chars.by_ref() {
                    if ch == '\n' {
                        break;
                    }
                }
            }
            c if c.is_whitespace() => {}
            _ => {
                // Unquoted token (rare in Steam files).
                let mut s = String::from(c);
                while let Some(&n) = chars.peek() {
                    if n.is_whitespace() || n == '{' || n == '}' || n == '"' {
                        break;
                    }
                    s.push(n);
                    chars.next();
                }
                out.push(Token::Str(s));
            }
        }
    }
    Ok(out)
}

/// Parses a document into a root object.
pub fn parse(src: &str) -> Result<Vdf, String> {
    let tokens = tokenize(src)?;
    let mut pos = 0;
    let entries = parse_entries(&tokens, &mut pos, true)?;
    Ok(Vdf::Obj(entries))
}

fn parse_entries(
    tokens: &[Token],
    pos: &mut usize,
    top: bool,
) -> Result<Vec<(String, Vdf)>, String> {
    let mut entries = Vec::new();
    while *pos < tokens.len() {
        match &tokens[*pos] {
            Token::Close if !top => {
                *pos += 1;
                return Ok(entries);
            }
            Token::Close => return Err("unexpected '}'".into()),
            Token::Open => return Err("unexpected '{'".into()),
            Token::Str(key) => {
                *pos += 1;
                match tokens.get(*pos) {
                    Some(Token::Str(v)) => {
                        entries.push((key.clone(), Vdf::Str(v.clone())));
                        *pos += 1;
                    }
                    Some(Token::Open) => {
                        *pos += 1;
                        let child = parse_entries(tokens, pos, false)?;
                        entries.push((key.clone(), Vdf::Obj(child)));
                    }
                    _ => return Err(format!("missing value for key '{key}'")),
                }
            }
        }
    }
    if top {
        Ok(entries)
    } else {
        Err("unterminated object".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nested_objects_and_escapes() {
        let doc = parse(
            r#"
            // comment
            "root"
            {
                "path"  "C:\\Games\\Steam"
                "child" { "a" "1" }
            }"#,
        )
        .unwrap();
        let root = doc.get("ROOT").unwrap();
        assert_eq!(root.get("path").unwrap().as_str(), Some(r"C:\Games\Steam"));
        assert_eq!(
            root.get("child").unwrap().get("a").unwrap().as_str(),
            Some("1")
        );
    }

    #[test]
    fn errors_on_unbalanced() {
        assert!(parse(r#""a" { "b" "c""#).is_err());
        assert!(parse(r#""a" }"#).is_err());
    }
}
