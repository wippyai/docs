# Writerside Markdown Guide for LLMs

## Overview
Writerside supports both Markdown and semantic XML markup, but **Markdown should be your default choice**. Use semantic XML elements only when Markdown can't achieve what you need. This hybrid approach gives you the best of both worlds: readable Markdown with powerful semantic features when needed.

## File Structure

### Markdown Files (.md)
Use `.md` files as your primary format:

```markdown
# Topic Title

This is regular Markdown content that's easy to read and write.

## Section Heading

Regular paragraph text using standard Markdown syntax.

- Bullet points work normally
- Second bullet point
- Third bullet point

1. Numbered lists
2. Work as expected
3. In standard Markdown

**Bold text** and *italic text* work normally.

`Inline code` works as expected.
```

### When to Inject Semantic XML
Only inject semantic XML elements when Markdown can't do what you need:

```markdown
# Getting Started

This is regular Markdown content.

<procedure title="Quick Setup">
<step>Install the dependencies</step>
<step>Configure the settings</step>
<step>Run the application</step>
</procedure>

More Markdown content continues here...

<tip>
Use semantic elements only when needed!
</tip>
```

## Markdown + Semantic XML Patterns

### Basic Document Structure
```markdown
# Main Topic Title

Regular introduction paragraph in Markdown.

## Prerequisites

Before you begin, ensure you have:

- Node.js installed
- A text editor
- Basic JavaScript knowledge

<tip>
This setup guide assumes you're using a Unix-based system.
</tip>
```

### Step-by-Step Instructions
```markdown
## Installation Process

<procedure title="Install the Application">
<step>
Download the installer from our website.
</step>
<step>
Run the installer:

```bash
sudo ./installer.sh
```
</step>
<step>
Follow the on-screen prompts to complete installation.
</step>
</procedure>

After installation, you can verify it worked by running `app --version`.
```

### Platform-Specific Content
```markdown
## Configuration

Set up the configuration file based on your operating system:

<tabs>
<tab title="Windows">

Create a file at `C:\Program Files\MyApp\config.yml`:

```yaml
database:
  host: localhost
  port: 5432
```
</tab>
<tab title="macOS/Linux">

Create a file at `/etc/myapp/config.yml`:

```yaml
database:
  host: localhost
  port: 5432
```
</tab>
</tabs>
```

### Code Documentation
```markdown
## API Reference

### Authentication

All API requests require authentication using Bearer tokens.

<code-block lang="bash" title="Example Request">
curl -X GET "https://api.example.com/users" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
</code-block>

The response will include user data:

```json
{
  "users": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```
```

### Admonitions and Callouts
```markdown
## Important Notes

<warning>
Always backup your database before running migrations.
</warning>

<note>
This feature is only available in version 2.0 and later.
</note>

<tip>
Use the `--verbose` flag to see detailed output during installation.
</tip>
```

### UI Instructions
```markdown
## User Interface Guide

To create a new project:

1. Click **File** → **New Project**
2. Select your project type
3. Choose a location and click **Create**

When the dialog appears, make sure to check the **Include sample files** option.

You can also use the keyboard shortcut <shortcut>Ctrl+Shift+N</shortcut> to quickly create a new project.
```

### Tables (Pure Markdown)
```markdown
## Comparison

| Feature | Basic Plan | Pro Plan | Enterprise |
|---------|------------|----------|------------|
| Users | 5 | 50 | Unlimited |
| Storage | 10GB | 100GB | 1TB |
| Support | Email | Phone | Dedicated |
```

### Conditional Content
```markdown
## Installation

<if instance="web">
For web deployment, use the online installer.
</if>

<if instance="desktop">
Download the desktop application from our releases page.
</if>

The basic setup process is the same regardless of platform.
```

### Variables in Markdown
```markdown
# Welcome to %product_name%

This guide covers %product_name% version %version%.

<tip>
Visit %support_url% if you need additional help.
</tip>
```

## Best Practices for Markdown-First Approach

### 1. Start with Pure Markdown
Begin every document with standard Markdown and only add semantic elements when needed:

```markdown
# Quick Start Guide

Welcome to our application! This guide will get you up and running in 5 minutes.

## What You'll Need

- A modern web browser
- An internet connection
- 10 minutes of your time

## Step 1: Create Account

Go to our signup page and create your account...
```

### 2. Add Semantic Elements Strategically
Only inject XML when Markdown can't do the job:

```markdown
# Advanced Configuration

For complex setups, follow these detailed steps:

<procedure title="Database Setup" id="db-setup">
<step>Create the database schema</step>
<step>Configure connection pooling</step>
<step>Set up monitoring</step>
</procedure>

<warning>
Database changes require application restart.
</warning>
```

### 3. Keep XML Blocks Continuous
When using semantic XML in Markdown, keep XML blocks together without blank lines:

```markdown
# Troubleshooting

<tabs>
<tab title="Connection Issues">
Check your network connection and firewall settings.
</tab>
<tab title="Performance Issues">
Monitor CPU and memory usage during peak hours.
</tab>
</tabs>

Back to regular Markdown content.
```

### 4. Use Markdown for Simple UI References
For basic UI elements, prefer Markdown over semantic markup:

```markdown
## Basic Navigation

Click the **Settings** button in the top-right corner.

Select `Advanced Options` from the dropdown menu.

Press `Ctrl+S` to save your changes.
```

Only use semantic markup for complex UI paths:

```markdown
Navigate to <ui-path>Settings | Advanced | Security | API Keys</ui-path>.
```

### 5. Leverage Markdown Extensions
Use Writerside's Markdown extensions for IDs and attributes:

```markdown
## Important Section {id="important-section"}

This heading has an ID for easy linking.

This is a key paragraph. {id="key-info"}

> This is a note about the feature.
{style="note"}
```

## Common Patterns

### Getting Started Guide
```markdown
# Getting Started with %product_name%

<tldr>
Install %product_name%, configure your API key, and make your first API call in under 5 minutes.
</tldr>

## Prerequisites

Before you begin, you'll need:

- A valid API key (get one [here](https://example.com/api-keys))
- Node.js 16 or higher
- Basic knowledge of REST APIs

## Quick Installation

<procedure title="Quick Setup">
<step>
Install via npm:

```bash
npm install @example/sdk
```
</step>
<step>
Set your API key:

```bash
export API_KEY="your_api_key_here"
```
</step>
<step>
Test the connection:

```javascript
const client = new ExampleClient(process.env.API_KEY);
await client.test();
```
</step>
</procedure>

## Next Steps

Now that you're set up, try these common tasks:

- [Make your first API call](first-api-call.md)
- [Explore the dashboard](dashboard-guide.md)
- [Set up webhooks](webhooks.md)
```

### API Documentation
```markdown
# Users API

## Get User Profile

Returns detailed information about a specific user.

<code-block lang="http" title="Request">
GET /api/v1/users/{userId}
Authorization: Bearer {token}
</code-block>

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | The unique user identifier |

### Response

<tabs>
<tab title="Success (200)">

```json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2023-01-15T10:30:00Z"
}
```
</tab>
<tab title="Not Found (404)">

```json
{
  "error": "User not found",
  "code": "USER_NOT_FOUND"
}
```
</tab>
</tabs>
```

### Troubleshooting Section
```markdown
# Troubleshooting

## Common Issues

### Connection Timeouts

If you're experiencing connection timeouts:

<procedure title="Diagnose Connection Issues">
<step>Check your internet connection</step>
<step>Verify the API endpoint URL</step>
<step>Test with a simple curl command:

```bash
curl -I https://api.example.com/health
```
</step>
<step>Check our [status page](https://status.example.com) for outages</step>
</procedure>

<tip>
Most connection issues are resolved by checking your API key and network configuration.
</tip>

### Authentication Errors

**Error**: `401 Unauthorized`

**Solution**: Your API key may be invalid or expired.

1. Verify your API key in the dashboard
2. Check that it has the required permissions
3. Regenerate the key if necessary

<warning>
Regenerating your API key will invalidate the old one immediately.
</warning>
```

## File Organization
- Use descriptive filenames: `getting-started.md`, `api-reference.md`, `troubleshooting.md`
- Keep related topics in folders: `guides/`, `api/`, `tutorials/`
- Use lowercase with hyphens for file names
- Start each file with a clear H1 heading that matches the topic title

## Summary

**Default to Markdown** for all content. Only inject semantic XML elements when you need:
- Step-by-step procedures (`<procedure>`, `<step>`)
- Platform-specific content (`<tabs>`, `<tab>`)
- Special callouts (`<tip>`, `<warning>`, `<note>`)
- Conditional content (`<if>`)
- Complex code blocks with special features
- UI path navigation (`<ui-path>`)

This approach keeps your content readable and maintainable while providing access to Writerside's powerful semantic features when needed.