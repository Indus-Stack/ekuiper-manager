# Theming

## Overview

eKuiper Manager supports three theme options:

- **Light**: bright surface with dark text.
- **Dark**: dark surface with light text.
- **System**: follows the operating system colour setting in real time.

The default theme is **Dark**. New sessions open in the dark theme until you select another option.

## Change the theme

You can change the theme from the header or from the Settings page. Both controls show the same active option.

### Use the header menu

1. On wide screens, select the sun or moon icon in the top-right header bar.
2. On narrow mobile screens, open the account menu in the top-right corner and find **Theme**.
3. Select **Light**, **Dark**, or **System**.

### Use the Settings page

1. Open **Manager -> Settings** from the navigation sidebar.
2. Find the **Theme** card.
3. Select **Light**, **Dark**, or **System**.

The browser stores your choice locally in `localStorage`.

## How it works

![Theme flow](assets/theming-flow.svg)

1. The root layout in `src/app/layout.tsx` includes a small inline script in `<head>`.
2. Before the page paints, the script reads `ekuiper.theme` from `localStorage`. If `ekuiper.theme` is absent, it reads the legacy `theme` key.
3. If the stored value is `light`, the script removes the `dark` class from `<html>`.
4. If the stored value is `system`, the script checks `(prefers-color-scheme: dark)` and sets the `dark` class to match.
5. If no value is stored or the value is invalid, the script keeps the `dark` class.
6. After React mounts, `ThemeProvider` reads the stored key (`ekuiper.theme`, or legacy `theme` when absent). It then listens for system preference changes.
7. `ThemeProvider` provides `theme`, `resolvedTheme`, and `setTheme` through `useTheme()`.

## Design tokens

CSS custom properties in `src/app/globals.css` define the light theme in `:root` and the dark theme in `.dark`.

| Token | Role |
|---|---|
| `--background`, `--foreground` | Main page background and body text |
| `--card`, `--card-foreground` | Card containers and text |
| `--popover`, `--popover-foreground` | Dropdowns, tooltips, and popovers |
| `--primary`, `--primary-foreground` | Primary action buttons and active highlights |
| `--secondary`, `--secondary-foreground` | Secondary controls and surfaces |
| `--muted`, `--muted-foreground` | Subtle surfaces and secondary text |
| `--accent`, `--accent-foreground` | Hover states and highlighted rows |
| `--destructive`, `--destructive-foreground` | Error states and destructive actions |
| `--border`, `--input`, `--ring` | Borders, form inputs, and focus rings |
| `--scrollbar-track`, `--scrollbar-thumb`, `--scrollbar-thumb-hover` | Custom scrollbar colours |
| `--flow-*` | Flow Studio canvas, nodes, and ports (mapped from core tokens) |

Use token utility classes such as `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, and `border-border`. Do not use fixed hex colours for standard surfaces or text.

## Add a themed component

Follow these rules when you create or update a UI component:

1. Use Tailwind semantic token classes (`bg-background`, `text-foreground`, `bg-card`, `border-border`) first.
2. If you must use a palette colour (for example emerald or amber), you must provide a `dark:` variant.
3. Verify that text meets a 4.5:1 contrast ratio against its background in both the light theme and the dark theme.
4. Use `bg-background` instead of dark hex backgrounds on editor wrappers.

## Editors and Flow Studio

- **Monaco Editor**: `CodeEditorImpl` and `ExpressionEditor` pass `theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}` to Monaco.
- **React Flow**: `FlowCanvas` passes `colorMode={resolvedTheme}` to `<ReactFlow>` so controls, background, and minimap match the active theme. Flow nodes use `--flow-*` tokens, and edge strokes use `--xy-edge-*` tokens for clear contrast in both themes.
- **Notifications**: `ThemedToaster` in `src/components/providers.tsx` passes `theme={resolvedTheme}` to Sonner.

## Test

Run the theme unit test suite with Jest:

```bash
npx jest src/lib/__tests__/theme.test.tsx --runInBand
```
