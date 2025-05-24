# Contributing to Wippy Docs Repository

Thank you for your interest in contributing to the Wippy Docs repository! Contributions are essential to improving the quality and coverage of documentation for the Wippy platform. This guide will help you understand how to contribute effectively.

## Table of Contents
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
    - [Reporting Issues](#reporting-issues)
    - [Proposing Changes](#proposing-changes)
    - [Submitting Pull Requests](#submitting-pull-requests)
- [Code and Documentation Standards](#code-and-documentation-standards)
- [Community Guidelines](#community-guidelines)
- [License](#license)

---

## Getting Started

1. **Fork the Repository**: Start by forking the Wippy Docs repository to your GitHub account.
2. **Clone the Repository**: Clone your fork locally using:

    ```bash
    git clone https://github.com/<your-username>/wippy-docs.git
    ```

3. **Set Up the Upstream Remote**: Add the original repository as an upstream remote:

    ```bash
    git remote add upstream https://github.com/wippyai/docs.git
    ```

4. **Install Dependencies**: If the repository uses any tools for documentation generation or validation, install them as described in the `README.md` or `package.json`.

---

## How to Contribute

### Reporting Issues

If you encounter any issues in the documentation or have suggestions for improvement:

1. Check the [issue tracker](https://github.com/wippyai/docs/issues) to see if the issue has already been reported.
2. If not, create a new issue with the following details:
    - A clear and descriptive title.
    - A detailed description of the problem or suggestion.
    - Steps to reproduce the issue, if applicable.
    - Screenshots or code snippets, if relevant.

### Proposing Changes

Before making significant changes, it's a good idea to discuss them with the maintainers:

1. Open a new issue or comment on an existing one to propose your changes.
2. Provide a clear explanation of the changes and why they are necessary.

### Submitting Pull Requests

1. **Create a Branch**: Create a new branch for your changes:

    ```bash
    git checkout -b feature/your-feature-name
    ```

2. **Make Changes**: Edit the documentation files and commit your changes with clear commit messages.

    ```bash
    git commit -m "Add detailed explanation for module X"
    ```

3. **Push Changes**: Push your branch to your forked repository:

    ```bash
    git push origin feature/your-feature-name
    ```

4. **Open a Pull Request**: Go to the original repository and open a pull request (PR) from your branch. Include:
    - A clear title and description of your changes.
    - Links to any related issues.
    - Screenshots or examples, if applicable.

---

## Code and Documentation Standards

To maintain consistency and quality, please adhere to the following standards:

1. **Documentation Engine**:
    - We use **Writeside** as our documentation engine.
      See the [Writeside documentation](https://www.jetbrains.com/help/writerside) for detailed guidance.
    - Contributors must follow Writeside conventions and best practices.
    - Prefer **Markdown files** over XML format wherever possible.
    - Use **semantic tags** to enhance content structure and meaning.

2. **LLM Assistance**: If you're using AI language models to help with documentation:
    - Review the [Writerside LLM Guide](../context/writerside-llm-guide.md) for best practices
    - This guide covers Markdown-first approach with semantic XML integration
    - Always review and validate AI-generated content before submitting

3. **Markdown Formatting**:
    - Use proper heading levels (`#`, `##`, `###`, etc.).
    - Use code blocks for examples and commands.
    - Write clear and concise descriptions.

4. **Style Guidelines**:
    - Follow the existing tone and style of the documentation.
    - Use American English for spelling and grammar.

5. **Code Examples**:
    - Ensure all code examples are functional and tested.
    - Use proper syntax highlighting in code blocks (e.g., ` ```yaml `, ` ```bash `).

6. **File Naming**:
    - Use lowercase and hyphens for file names (e.g., `module-overview.md`).

---

## Community Guidelines

We strive to maintain a welcoming and inclusive community. Please adhere to the following guidelines:

- Be respectful and constructive in your communication.
- Avoid personal attacks or inappropriate language.
- Follow the Wippy Code of Conduct

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the repository.

---

Thank you for contributing to Wippy Docs! Your efforts help make the Wippy platform better for everyone.
