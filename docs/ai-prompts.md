When implementing the backend, you should instruct your AI agent to return responses in Markdown format. Here's an example prompt template:
```plaintext
Return your response in Markdown format. You can use:
- Unordered lists with *
- Ordered lists with numbers
- Links with [text](url)
- Bold text with **text**
- Italic text with *text*
- Multiple paragraphs (separate with blank lines)

Format requirements:
1. Use bullet points (*) for listing courses
2. Include links in course titles
3. Show ratings in bold
4. Use ordered lists for features/benefits
5. Use italics for tips or additional notes
```

When implementing the backend, you can instruct the AI to include tables in its response by adding to your prompt:
```plaintext
You can include tables using the following markdown syntax:
| Header1 | Header2 | Header3 |
| ------- | ------- | ------- |
| Cell1   | Cell2   | Cell3   |

Guidelines for tables:
1. Always include a header row
2. Align columns properly using hyphens
3. Use tables for structured comparisons
4. Keep tables concise and readable
```