---
name: create-pr
description: Create GitHub pull requests with proper formatting. Use when creating PRs to ensure correct template and no AI attribution.
---

# Create Pull Request

Create properly formatted GitHub pull requests.

## Steps

1. Verify all changes are committed
2. Push the branch to origin
3. Create the PR using gh cli:

```
gh pr create --title "short title" --body "$(cat <<'EOF'
## Summary
- bullet points describing changes

## Test plan
- how to verify the changes work

## Affected areas
- which parts of the app are affected
EOF
)"
```

4. After creation, verify no emoji or AI attribution lines in the PR body
5. Return the PR URL

## Rules

- Title under 70 characters
- No emojis in title or body
- No AI attribution lines ("Generated with..." etc.)
- Summary must describe actual changes made
- Test plan must include verifiable steps
- Always push branch before creating PR
