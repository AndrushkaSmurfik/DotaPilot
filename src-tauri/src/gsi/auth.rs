//! Token check for incoming GSI requests.

/// Constant-time comparison so response timing doesn't leak the token.
pub fn token_matches(received: Option<&str>, expected: &str) -> bool {
    let Some(received) = received else {
        return false;
    };
    if expected.is_empty() || received.len() != expected.len() {
        return false;
    }
    received
        .bytes()
        .zip(expected.bytes())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

/// Tokens end up inside a quoted VDF string, so only allow a safe charset.
pub fn is_valid_token(token: &str) -> bool {
    (16..=128).contains(&token.len())
        && token
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_only_exact_token() {
        assert!(token_matches(Some("abc123"), "abc123"));
        assert!(!token_matches(Some("abc124"), "abc123"));
        assert!(!token_matches(Some("abc"), "abc123"));
        assert!(!token_matches(None, "abc123"));
        assert!(!token_matches(Some(""), ""));
    }

    #[test]
    fn validates_token_charset() {
        assert!(is_valid_token("0123456789abcdef-_XYZ"));
        assert!(!is_valid_token("short"));
        assert!(!is_valid_token("has\"quote-0123456789"));
        assert!(!is_valid_token("has space 0123456789"));
    }
}
