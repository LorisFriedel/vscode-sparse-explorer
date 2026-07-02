# Publishing to the VS Code Marketplace

This document covers everything needed to publish the Sparse Explorer extension to the
[VS Code Marketplace](https://marketplace.visualstudio.com/).

> **Note on PATs:** Personal Access Tokens for Marketplace publishing are retired on
> **December 1, 2026**. These instructions use `--azure-credential` exclusively.

---

## Contents

- [One-time account setup](#one-time-account-setup)
- [Publishing locally](#publishing-locally)
- [Publishing from CI (GitHub Actions)](#publishing-from-ci-github-actions)
- [Updating the CI workflow](#updating-the-ci-workflow)

---

## One-time account setup

### 1. Microsoft account

Sign in or create an account at https://account.microsoft.com. The same account is used
for the Marketplace publisher portal and Azure CLI login.

### 2. Create a publisher

1. Go to https://marketplace.visualstudio.com/manage and sign in.
2. Click **Create publisher** and fill in:
   - **ID**: `eric-mountain` — must exactly match the `"publisher"` field in `package.json`.
   - **Display name**: anything (shown on the Marketplace listing).
3. Save.

### 3. Authorize your Azure identity as a publisher member

The publisher must explicitly grant publish rights to the Azure identity that will be
used at publish time. You need to do this separately for:

- **Local publishing**: your personal Microsoft account (the one you log in with via
  `az login`).
- **CI publishing**: the managed identity created in the CI setup below.

To add a member:

1. Go to https://marketplace.visualstudio.com/manage → select publisher `eric-mountain`.
2. Open the **Members** tab → **Add**.
3. Search for the account or identity and set the role to **Owner**.

---

## Publishing locally

### Install Azure CLI

```sh
brew install azure-cli
```

### Log in

```sh
az login
```

This opens a browser for interactive sign-in. The session persists until you `az logout`
or the token expires.

### Publish

```sh
npx vsce publish --azure-credential
```

`vsce` uses `DefaultAzureCredential`, which picks up the active `az login` session
automatically. No PAT or stored secret is needed.

To do a dry run that packages but does not publish:

```sh
npm run package      # produces vscode-sparse-explorer-<version>.vsix
```

---

## Publishing from CI (GitHub Actions)

The CI workflow (`.github/workflows/ci.yml`) already packages and creates a GitHub
Release on a `v*` tag push. These steps extend it to also publish to the Marketplace
using **workload identity federation** — no long-lived secrets required.

### Step 1 — Create a User-Assigned Managed Identity in Azure

1. Open the [Azure portal](https://portal.azure.com) and sign in.
2. Search for **Managed Identities** → **Create**.
3. Fill in:
   - **Subscription**: any subscription you have access to.
   - **Resource group**: create a new one (e.g. `vscode-extension-publishing`) or reuse an existing one.
   - **Region**: any.
   - **Name**: e.g. `sparse-explorer-publisher`.
4. Click **Review + create** → **Create**.
5. Once created, open the resource and note:
   - **Client ID** (a GUID)
   - **Tenant ID** (a GUID, shown under Overview → Directory (tenant) ID)
   - **Subscription ID** (shown at the top of any subscription page)

### Step 2 — Add federated credentials

This tells Azure to trust GitHub Actions tokens issued for this repository.

1. In the managed identity resource, go to **Settings → Federated credentials** → **Add credential**.
2. Select scenario **GitHub Actions deploying Azure resources**.
3. Fill in:
   - **Organisation**: `EricMountain`
   - **Repository**: `vscode-sparse-explorer`
   - **Entity type**: `Tag`
   - **Based on tag**: `v*`
   - **Name**: e.g. `github-actions-tag-push`
4. Save.

The subject claim this produces (`repo:EricMountain/vscode-sparse-explorer:ref:refs/tags/v*`)
scopes the credential to tag-push workflows only, not every workflow run.

### Step 3 — Authorize the managed identity as a publisher member

1. Go to https://marketplace.visualstudio.com/manage → publisher `eric-mountain` → **Members** → **Add**.
2. Search by the managed identity's **Client ID** (the GUID from Step 1).
3. Set role to **Owner** and save.

### Step 4 — Store the IDs as GitHub Actions secrets

These are configuration values, not credentials, but GitHub secrets is the standard
place to store per-repo parameters.

In the repository on GitHub: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Value |
|---|---|
| `AZURE_CLIENT_ID` | Client ID from Step 1 |
| `AZURE_TENANT_ID` | Tenant ID from Step 1 |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID from Step 1 |

---

## Updating the CI workflow

Add OIDC permissions and an Azure login + publish step to the `release` job in
`.github/workflows/ci.yml`.

The job currently ends after creating the GitHub Release. Extend it as follows:

```yaml
  release:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write        # required for OIDC token exchange
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - name: Verify package.json version matches tag
        run: |
          PKG_VERSION="v$(node -p "require('./package.json').version")"
          TAG_VERSION="${GITHUB_REF_NAME}"
          if [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
            echo "ERROR: package.json has $PKG_VERSION but tag is $TAG_VERSION"
            exit 1
          fi
      - run: npm run package
      - uses: softprops/action-gh-release@v3
        with:
          files: '*.vsix'
          generate_release_notes: true
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Publish to Marketplace
        run: npx vsce publish --azure-credential
```

The `id-token: write` permission is what allows the workflow to request an OIDC token
from GitHub. The `azure/login` action exchanges that token for an Azure access token,
which `vsce --azure-credential` then uses via `DefaultAzureCredential`.

---

## Quick reference

| Task | Command |
|---|---|
| First-time local login | `az login` |
| Publish locally | `npx vsce publish --azure-credential` |
| Package only (no publish) | `npm run package` |
| Verify what will be packaged | `npx vsce ls` |
| Check published metadata | `npx vsce show eric-mountain.vscode-sparse-explorer` |
| Cut a release (triggers CI) | See release steps in `CLAUDE.md` |
