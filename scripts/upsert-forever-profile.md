# Save an exported profile as a Forever preset

This tool inserts or updates a permanent profile in
`js/data/presets_forever.js`. Run the commands below from the WarriorSim
repository root with Node.js installed.

## Export and paste a profile

1. Open the site's **WoW Forever** tab.
2. Open **Profiles** and click the **Export** icon on the profile to save.
   The site copies the export to your clipboard.
3. Run:

   ```sh
   npm run profile:upsert -- --id forever-my-build
   ```

4. Paste the copied export at the prompt and press **Enter**.

The command updates the entry with that exact ID, or appends a new entry if the
ID does not exist. Use lowercase letters, digits, and single hyphens for IDs.
Keep using the same ID when revising or renaming a build; the exported display
name does not determine which entry gets updated.

Existing preset IDs:

- `forever-dual-wield-fury`
- `forever-two-handed-fury`
- `forever-two-handed-arms`

For example, to replace the existing dual-wield preset:

```sh
npm run profile:upsert -- --id forever-dual-wield-fury
```

## Read an export from a file

Save the copied export to `profile.txt`, then run:

```sh
npm run profile:upsert -- --id forever-my-build --input profile.txt
```

The input can contain either the site's base64 export or decoded profile JSON.

To also set the description shown beneath the preset name:

```sh
npm run profile:upsert -- --id forever-my-build --input profile.txt --description "My raid build"
```

Existing descriptions are preserved unless `--description` is supplied. New
entries default to the exported profile name.

## Read directly from the clipboard in PowerShell

```powershell
Get-Clipboard | node scripts/upsert-forever-profile.js --id forever-my-build
```

## Preview the change

Use `--dry-run` to print the proposed catalog without changing the destination:

```sh
npm run profile:upsert -- --id forever-my-build --input profile.txt --dry-run
```

To save a preview to a separate file, invoke Node directly so the output contains
only the proposed JavaScript:

```sh
node scripts/upsert-forever-profile.js --id forever-my-build --input profile.txt --dry-run > presets-preview.js
```

## Options

| Option | Purpose |
| --- | --- |
| `--id ID` | Required. Update this preset ID, or insert it if absent. |
| `--input FILE`, `-i FILE` | Read an export file. Defaults to a paste prompt or piped stdin; `-` explicitly selects stdin. |
| `--description TEXT` | Set the preset's description. |
| `--presets FILE` | Edit a different existing catalog file. Defaults to this checkout's `js/data/presets_forever.js`. |
| `--dry-run` | Print the proposed catalog without writing it. |
| `--help`, `-h` | Show command help. |

## Review and use the updated preset

The script and website use the same advisory compatibility validator. It reports
talent migrations and refunds, unsupported talent schemas, unknown catalog IDs,
unavailable abilities, legacy rotation entries without `active`, and settings
that will inherit defaults. It also flags invalid race, level, and numeric values.

The script prints the findings as plain text to stderr and continues the upsert.
This also happens with `--dry-run`, whose stdout remains the proposed catalog.
The profile stored in the catalog retains the supplied data; the website's
existing loader applies migrations when the preset is used.

The website shows the findings in a **Profile compatibility notes** dialog with
an **OK** button. Imports and preset selection complete before the dialog is
dismissed. Saved browser profiles are also checked when loaded. Ordinary imports
report settings inherited from the current profile; presets report defaults.

The tool validates the export's structure before writing and replaces the entire
profile for the selected ID. Other presets and header comments are preserved.
Malformed exports still fail the existing structural checks and leave the
destination unchanged. Compatibility findings are advisory and do not reject
an otherwise importable profile.

Review the change:

```sh
git diff -- js/data/presets_forever.js
```

Rebuild the browser assets using the [build instructions](../CONTRIBUTING.md#build-the-browser-assets)
to make the updated preset available on your served site. The first-visit defaults
in `js/data/session_forever.js` are maintained separately.
