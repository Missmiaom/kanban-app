# Kanban App

A Jira-like Kanban desktop application for **Windows**, built with **Electron**.

## Features

- **Jira-style task board** — columns for Backlog → To Do → In Progress → In Review → Done.
- **Drag-and-drop workflow** — drag task cards between columns to move them through the flow.
- **Task management** — create, edit, view, and delete tasks with summary, description, priority, and assignee.
- **Local persistence** — tasks are saved to a JSON file in the OS app-data directory, so the board survives restarts.
- **Priority badges & assignee avatars** — Jira-like visual density.
- **Light, dark & forest themes** — follows your OS preference by default, with a topbar toggle to cycle through and remember your choice.

## Tech stack

- [Electron](https://www.electronjs.org/) (desktop shell, Windows target)
- Vanilla HTML/CSS/JS (no build step for the renderer)

## Getting started

```bash
npm install
npm start
```

## Packaging a Windows installer

```bash
npm run package
```

Produces a Windows NSIS installer in `dist/` via [electron-builder](https://www.electronbuilder.com).

## Project layout

```
main.js            Electron main process (window + storage IPC)
preload.js         Context-isolated bridge to the renderer
renderer/          Renderer UI (index.html, styles.css, app.js)
package.json       Project + build config
```