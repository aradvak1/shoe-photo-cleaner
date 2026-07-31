# Security Policy

## Supported Versions

This project does not use formal release versioning — only the latest commit on `master` is supported.

## Reporting a Vulnerability

If you discover a security vulnerability (e.g. an auth bypass, exposed credentials, injection issue, or a way to access another user's data), please **do not open a public GitHub issue**.

Instead, report it privately by emailing **aradvak1@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (or a proof of concept)
- Any relevant logs, screenshots, or affected URLs/endpoints

You should receive an acknowledgment within a few days. Please allow time for the issue to be investigated and fixed before disclosing it publicly.

## Scope

This repository contains application source code only. Live credentials, API keys, and database connection strings are kept in untracked `.env.local` files / the Vercel project's environment variables and are never committed — if you find one that has slipped into the repo history, please report it immediately via the contact above.
