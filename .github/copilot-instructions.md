# 🤖 Copilot Instructions for Portfolio Development

> Instructions for the Copilot assistant when working on this portfolio codebase

---

## ⚠️ CRITICAL RULES

### 1. **ADD MARKERS TO ALL NEW CODE**
Every time you add or modify code:
- Add `// MARKER: FEATURE_NAME - Description` comments to new sections
- Use `// MARKER: FEATURE_NAME_START/END` for multi-line sections
- Format: `// MARKER: DESCRIPTIVE_NAME - What this section does`
- **Example:**
  ```typescript
  // MARKER: NEW_FEATURE_FUNCTION - Handles user input validation
  protected validateUserInput(input: string): boolean {
    // ... implementation
  }
  ```

### 2. **NEVER MODIFY THESE FILES**
- `src/assets/*.json` - Only update via code, not direct edits
- `.git/` - Git configuration
- `dist/`, `node_modules/`, `.angular/` - Generated files
- Existing markers - Don't remove, only add

### 3. **ADD COMMENTS TO CONFUSING CODE**
- Complex logic → explain what it does
- Non-obvious algorithms → add high-level comment
- Keep comments minimal, let code speak for itself
- Format: `// MARKER: PURPOSE - What this does and why`

### 4. **UPDATE DOCUMENTATION AFTER CHANGES**
When you add a marker, update: `MARKERS.md` with entry

---

## 📝 WHERE TO ADD MARKERS

### TypeScript Files (`src/app/app.component.ts`)
```typescript
// MARKER: FEATURE_NAME - Description
export class AppComponent {
  protected myProperty: string;
  
  // MARKER: METHOD_NAME - What it does
  protected myMethod(): void {
    // implementation
  }
}
```

### HTML Templates (`src/app/app.component.html`)
```html
<!-- MARKER: SECTION_NAME - Description -->
<section class="my-section">
  <!-- content -->
</section>
<!-- MARKER: SECTION_NAME_END -->
```

### CSS Files
```css
/* MARKER: SECTION_NAME - Description */
.my-class {
  /* styles */
}
```

---

## 🔄 WORKFLOW FOR CHANGES

### When Adding a Feature:
1. ✅ Add code with `MARKER:` comments
2. ✅ Run `npm run build` - must pass
3. ✅ Run `npm start` - test locally
4. ✅ Update `MARKERS.md` with new marker location
5. ✅ Commit with clear message: "Added [feature] with marker: MARKER_NAME"

### When Modifying Existing Code:
1. ✅ Find the existing marker
2. ✅ Update the code
3. ✅ Keep the marker (don't remove)
4. ✅ Add new markers if adding new logic
5. ✅ Test with `npm start`
6. ✅ Commit: "Modified [section] - MARKER: NAME"

### When Fixing Bugs:
1. ✅ Locate the section with its marker
2. ✅ Fix the bug
3. ✅ Add comment explaining the fix
4. ✅ Test thoroughly
5. ✅ Commit: "Fixed [issue] in MARKER: NAME section"

---

## 📊 DATA STRUCTURE RULES

### JSON Files (`src/assets/`)
- These are single source of truth
- Component loads and displays them
- **To update content:** Edit JSON, not code
- **To update structure:** Add marker comment in TypeScript that loads it

### Component Data Flow:
```
JSON → TypeScript → HTML → Display
```

**Example:** To change email
1. Edit `src/assets/profile/profile.json`
2. Component loads it (see `MARKER: PROFILE_LOADING`)
3. HTML displays it (see `MARKER: PROFILE_DATA_SECTION`)

---

## 🚀 QUICK REFERENCE

### Common Tasks

**Add a New Component Method:**
```typescript
// MARKER: NEW_METHOD_NAME - What it does
protected newMethod(): void {
  // implementation
}
```

**Add a New Template Section:**
```html
<!-- MARKER: NEW_SECTION_NAME - Description -->
<section>content</section>
<!-- MARKER: NEW_SECTION_NAME_END -->
```

**Add a New Style Block:**
```css
/* MARKER: NEW_STYLE_NAME - Description */
.new-class { /* styles */ }
```

**Modify Existing Content:**
1. Search: `Ctrl+F → MARKER: SECTION_NAME`
2. Jump to it
3. Edit
4. Keep the marker
5. Test & commit

---

## ✅ CHECKLIST BEFORE COMMITTING

- [ ] Code has markers for new sections
- [ ] Confusing code has explanatory comments
- [ ] `npm run build` passes (no errors)
- [ ] `npm start` works (no runtime errors)
- [ ] JSON files are valid (run through validator if changed)
- [ ] `MARKERS.md` updated with new markers
- [ ] Commit message references marker/section
- [ ] No files outside `.git`, `dist`, `node_modules` removed
- [ ] No breaking changes to existing markers

---

## 📚 KEY FILES & THEIR MARKERS

**Main Component:** `src/app/app.component.ts`
- `MARKER: COMPONENT_START` - Entry point
- `MARKER: PROFILE_DATA_SECTION` - Contact/links
- `MARKER: CHAT_SYSTEM_START/END` - AI chat
- `MARKER: PDF_GENERATION_SECTION` - Resume creation
- `MARKER: DATA_LOADING_SECTION` - JSON fetch
- ... (see MARKERS.md for complete list)

**Template:** `src/app/app.component.html`
- `MARKER: HEADER_SECTION_START/END` - Navigation
- `MARKER: HERO_BACKGROUND_AND_COPY` - Hero section
- `MARKER: SERVICES_SECTION` - What I bring
- `MARKER: PROJECTS_SECTION` - Portfolio
- `MARKER: EXPERIENCE_SECTION` - Work history
- ... (see MARKERS.md for complete list)

---

## 🔍 SEARCHING FOR CODE

When asked to modify something:
1. **Know what section:** "Update email display"
2. **Search for marker:** `Ctrl+F → MARKER: PROFILE_DATA`
3. **Find the code**
4. **Make changes**
5. **Test locally**

---

## 🎯 MARKER NAMING CONVENTION

**Pattern:** `MARKER: DESCRIPTIVE_NAME - Short description`

**Rules:**
- Use SCREAMING_SNAKE_CASE
- Be descriptive (not just `MARKER: FIX`)
- Include START/END for multi-line sections
- One line: single marker
- Multiple lines: START/END pair

**Examples:**
- ✅ `MARKER: THEME_TOGGLE_FUNCTION - Switches between day/night`
- ✅ `MARKER: HERO_SECTION_START` / `MARKER: HERO_SECTION_END`
- ❌ `MARKER: FIX` (too vague)
- ❌ `marker: lowercase` (wrong case)
- ❌ `Marker: Mixed-Case` (wrong format)

---

## 📋 MARKER.MD UPDATE FORMAT

When adding a new marker, add to `MARKERS.md`:

```
| `MARKER: FEATURE_NAME` | FEATURE_PURPOSE | File | Edit For | Line ~ |
|--------|---------|------|----------|---|
| FEATURE_NAME | Description | src/app/app.component.ts | Changing feature behavior | ~123 |
```

---

## 🚨 WHAT COPILOT SHOULD DO

✅ **DO:**
- Add markers to new code
- Comment confusing logic
- Update MARKERS.md
- Run build/test commands
- Explain what markers do
- Help find sections using markers

❌ **DON'T:**
- Remove existing markers
- Modify asset files directly
- Change JSON structure without marker
- Skip documentation updates
- Commit without clear message
- Delete generated files

---

## 💡 PRO TIPS FOR COPILOT

1. **Always search first:** `Ctrl+F → MARKER:` before making changes
2. **Keep markers unique:** No duplicate marker names
3. **Comment the why:** "What" is in code, comment the "why"
4. **Test immediately:** `npm start` after each change
5. **Build verification:** `npm run build` before committing
6. **Update documentation:** Keep MARKERS.md in sync
7. **Clear commits:** Reference the marker in commit message

---

## 🤔 IF YOU'RE UNSURE

Before making changes:
1. Search for similar existing markers
2. Follow the same pattern/style
3. Add a comprehensive comment
4. Test thoroughly
5. Document the change

---

## 📞 QUICK LINKS

| Need | Location |
|------|----------|
| All markers | `MARKERS.md` |
| Marker locations | Search `MARKER:` in IDE |
| Data files | `src/assets/` |
| Component logic | `src/app/app.component.ts` |
| Template | `src/app/app.component.html` |
| Component styles | `src/app/app.component.css` |
| Global styles | `src/styles.css` |

---

## ✨ SUMMARY

**Golden Rules:**
1. 🏷️ Add markers to all new code
2. 📝 Comment confusing logic
3. 🔧 Update MARKERS.md after changes
4. ✅ Test before committing
5. 📦 Build must pass
6. 🎯 Keep markers descriptive

**Workflow:**
Search → Edit → Comment → Test → Document → Commit

**Result:** Clean, navigable, maintainable codebase!

---

*Last Updated: November 24, 2026*  
*For portfolio: neonpokharkarportfolio*  
*Status: Active*
