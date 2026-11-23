# 🎯 Marker System - Master Reference

**Status:** ✅ Complete | **Markers:** 34+ | **Build:** Passing  
**Last Updated:** November 24, 2026

---

## 📋 Quick Start

1. **New to this?** → Read the section below: "How It Works"
2. **Want to edit something?** → Jump to: "Common Tasks" 
3. **Adding new code?** → Follow: ".COPILOT_INSTRUCTIONS.md"
4. **Need details?** → Check: "All Markers by File"

---

## 🏷️ How It Works

Every important section in your code has a **marker comment**:

```typescript
// MARKER: FEATURE_NAME - What this does
```

**To find any section:**
1. Press `Ctrl+F` in VS Code
2. Type: `MARKER: SECTION_NAME`
3. Jump directly to it

**That's it!** No more scrolling through hundreds of lines.

---

## 🚀 Common Tasks (Copy the Marker Name to Search)

| Task | Marker to Search | File | Edit |
|------|-----------------|------|------|
| Update email | `MARKER: PROFILE_DATA_SECTION` | `src/assets/profile/profile.json` | email field |
| Update phone | `MARKER: PROFILE_DATA_SECTION` | `src/assets/profile/profile.json` | phone field |
| Change availability | `MARKER: PROFILE_DATA_SECTION` | `src/assets/profile/profile.json` | availability object |
| Add work experience | - | `src/assets/experience/experience.json` | Add entry |
| Add education | - | `src/assets/education/education.json` | Add entry |
| Add project | - | `src/assets/projects/projects.json` | Add entry |
| Update hero headline | `MARKER: HERO_BACKGROUND_AND_COPY` | `src/app/app.component.html` | <h1> text |
| Change intro text | `MARKER: INTRO_SECTION` | `src/app/app.component.html` | <p> text |
| Modify availability indicator | `MARKER: CURRENT_FOCUS_SECTION` | `src/assets/profile/profile.json` | state/label/activity |
| Update nav menu | `MARKER: MAIN_NAVIGATION` | `src/app/app.component.html` | <a> tags |
| Modify PDF resume | `MARKER: PDF_GENERATION_SECTION_START` | `src/app/app.component.ts` | generateResumePdf() |
| Change theme colors | - | `src/styles.css` | CSS variables |
| Modify AI chat | `MARKER: CHAT_SYSTEM_START` | `src/app/app.component.ts` | sendChatMessage() |
| Update social links | `MARKER: PROFILE_DATA_SECTION` | `src/assets/profile/profile.json` | linkedin/github |

**Note:** Items without markers are in JSON files - edit directly!

---

## 📍 All Markers by File

### Static generation (`scripts/generate-static.mjs`)

| Marker | Purpose | Edit For |
|--------|---------|----------|
| `STATIC_DISCOVERY_START/END` | Build-time sitemap and crawlable project and essay pages | Public routes or static page generation |
| `STATIC_DISCOVERY_TESTS` | Checks generated sitemap and page content | Static generation tests |
| `STATIC_DISCOVERY_CI` | Runs static checks before deploying GitHub Pages | Deployment validation |

### TypeScript Component (`src/app/app.component.ts`)

| Marker | Purpose | Edit For | Line ~ |
|--------|---------|----------|--------|
| `COMPONENT_START` | Main component entry | Reference | ~1 |
| `INTERFACES_SECTION` | TypeScript data types | Adding new data structures | ~6 |
| `THEME_SYSTEM_START/END` | Day/night theme toggle | Theme colors, default theme | ~120-130 |
| `LIFECYCLE_AND_ROUTING` | Constructor & route checks | Adding route handlers | ~135 |
| `SCROLL_AND_MOUSE_TRACKING` | Animation triggers | Modifying animations | ~160 |
| `PROFILE_DATA_SECTION` | Contact info, links, availability | Profile data, email, phone | ~165-180 |
| `CHAT_SYSTEM_START/END` | AI chat state management | Chat behavior, messages | ~185-200 |
| `PORTFOLIO_ARRAYS_SECTION` | Skills, projects, experience, education | Understanding data flow | ~215 |
| `DATA_LOADING_SECTION` | JSON file fetching | Changing file paths | ~220-280 |
| `PROFILE_LOADING` | Load profile.json | Profile loading logic | ~265 |
| `PDF_GENERATION_SECTION_START/END` | Resume PDF creation | PDF styling, layout, sections | ~285-460 |
| `EVENT_LISTENERS_START/END` | Mouse/scroll/keyboard events | Adding event handlers | ~575-590 |
| `NAVIGATION_AND_UI_HANDLERS` | Menu, theme, logo interactions | UI behavior | ~595 |
| `THEME_INITIALIZATION_AND_APPLICATION` | Theme detection & storage | Theme persistence | ~615 |
| `CHAT_SYSTEM_END` | Chat API integration | Chat behavior | ~760 |

### Project routes (`src/app/app.routes.ts`)

| Marker | Purpose | Edit For |
|--------|---------|----------|
| `PROJECT_MEDIA_LAZY` | Lazy-load project gallery images | Gallery markup |
| `PROJECT_MEDIA_OBSERVER_START/END` | Prepare animated previews near the viewport | Gallery loading behavior |

### HTML Template (`src/app/app.component.html`)

| Marker | Purpose | Edit For | Line ~ |
|--------|---------|----------|--------|
| `HEADER_SECTION_START/END` | Navigation bar | Header structure | 1-30 |
| `MAIN_NAVIGATION` | Menu links | Nav items | ~20 |
| `HEADER_ACTIONS` | Theme toggle + Resume | Button text, icons | ~35 |
| `RESUME_ERROR_ALERT` | Error message display | Error text | ~45 |
| `CLICK_POINTER_ANIMATION` | Logo click effect | Animation style | ~55 |
| `MAIN_CONTENT_AREA` | Homepage wrapper | Layout structure | ~60 |
| `HERO_BACKGROUND_AND_COPY` | Hero headline & CTAs | Headline text, description | ~70 |
| `HERO_ANIMATION` | Black hole animation | Animation visuals | ~95 |
| `INTRO_SECTION` | About/intro area | About text | ~110 |
| `SERVICES_SECTION` | What I bring cards | Loaded from JSON | ~125 |
| `CURRENT_FOCUS_SECTION` | Availability status | Loaded from JSON | ~140 |
| `SKILLS_SECTION` | Toolkit & interests | Loaded from arrays | ~160 |
| `PROJECTS_SECTION` | Portfolio projects | Loaded from JSON | ~180 |
| `EXPERIENCE_SECTION` | Work history | Loaded from JSON | ~195 |
| `EDUCATION_SECTION` | Academic background | Loaded from JSON | ~210 |
| `CONTACT_SECTION` | Final CTA & links | Email, social links | ~225 |
| `CUSTOM_CURSOR_ANIMATION` | Mouse cursor animation | Cursor visuals | ~235 |
| `CHAT_LAUNCHER_BUTTON` | AI chat button | Button text | ~250 |
| `CHAT_PANEL` | Chat sidebar | Chat interface | ~260-290 |
| `FOOTER_SECTION` | Copyright & links | Copyright year, tagline | ~295-300 |
| `DYNAMIC_PAGES` | Sub-pages outlet | Route handling | ~305 |

---

## 📊 Data Files (No Markers - Edit Directly)

| File | Contains | Edit For |
|------|----------|----------|
| `src/assets/profile/profile.json` | Contact, skills, availability | Email, phone, links, skills |
| `src/assets/experience/experience.json` | Work history | Adding/updating jobs |
| `src/assets/education/education.json` | Academic background | Adding/updating degrees |
| `src/assets/projects/projects.json` | Portfolio projects | Adding/updating projects |
| `src/assets/vision/vision.json` | Mission statement | Updating mission |
| `src/assets/links/links.json` | Social media URLs | Updating social links |
| `src/assets/hobbies/hobbies.json` | Hobbies | Updating interests |
| `src/assets/essays/essays.json` | Essay metadata | Adding essays |

---

## 🔄 Data Flow

```
JSON Files (Content)
    ↓
    Loaded by TypeScript Component
    (src/app/app.component.ts - See MARKER: DATA_LOADING_SECTION)
    ↓
    Displayed in HTML Template
    (src/app/app.component.html - See specific MARKER)
    ↓
    Styled by CSS
    (src/styles.css, src/app/app.component.css)
```

**Key:** To update content, usually edit JSON files, not code!

---

## ✅ Implementation Details

✅ **34+ markers placed** in TypeScript and HTML  
✅ **Build verified** - no errors introduced  
✅ **Searchable** - use Ctrl+F to find any section  
✅ **Well-organized** - markers grouped by functionality  
✅ **Production-ready** - markers stripped in build  

---

## 🚀 For New Code (Copilot & Future Edits)

**Golden Rules:**
1. Add `// MARKER: NAME - Description` to all new sections
2. Add `/* MARKER: NAME_START/END */` for multi-line sections
3. Update this file (MARKERS.md) with new marker entries
4. Run `npm run build` - must pass
5. Run `npm start` - test locally
6. Commit with marker reference in message

**Example:**
```typescript
// MARKER: NEW_FEATURE_NAME - What this does
protected newFeature(): void {
  // implementation
}
```

**See:** `.COPILOT_INSTRUCTIONS.md` for detailed guidelines

---

## 📞 Quick Reference

| Need | Action |
|------|--------|
| Find section | `Ctrl+F → MARKER: NAME` |
| List all markers | Search `MARKER:` |
| Add new code | Add marker comment + update this file |
| Update content | Edit JSON in `src/assets/` |
| Test changes | `npm start` |
| Build verify | `npm run build` |
| See all tasks | Read "Common Tasks" section above |

---

## 🎯 Marker Naming Convention

**Format:** `MARKER: DESCRIPTIVE_NAME - Short description`

**Rules:**
- Use SCREAMING_SNAKE_CASE
- Be specific (not just `MARKER: FIX`)
- Include START/END for multi-line sections
- Keep descriptions under 50 characters

**Examples:**
- ✅ `MARKER: THEME_SYSTEM_START` / `MARKER: THEME_SYSTEM_END`
- ✅ `MARKER: PROFILE_DATA_SECTION`
- ✅ `MARKER: PDF_GENERATION_SECTION_START`
- ❌ `marker: fix` (lowercase, vague)
- ❌ `Marker: Random` (wrong format)

---

## 📋 When Adding a Marker

Add entry to this file (MARKERS.md) in the correct "All Markers by File" section:

```markdown
| `MARKER: NEW_NAME` | What it does | Edit for | ~LINE |
```

Then commit with message like:
```
Added [feature] with marker: MARKER: NEW_NAME
```

---

## 💡 Pro Tips

| Tip | Benefit |
|-----|---------|
| `Ctrl+F → MARKER:` | See all markers in file |
| `Ctrl+Shift+F → MARKER:` | Search project-wide |
| Keep this file open | Quick reference |
| Reference markers in commits | Easy to track changes |
| Test after each change | Catch bugs early |

---

## 🎓 Key Principles

1. **Markers are comments** - no performance impact
2. **GPS navigation** - search to find any section instantly
3. **Data-driven** - content in JSON, component displays it
4. **Self-documenting** - markers explain what code does
5. **Maintainable** - easy to find, understand, and modify

---

## ✨ What You Have

✅ **34+ markers** throughout codebase  
✅ **Easy navigation** - search to find sections  
✅ **Clear documentation** - this file  
✅ **Copilot guidelines** - `.COPILOT_INSTRUCTIONS.md`  
✅ **Build verified** - no errors  
✅ **Ready to extend** - add markers to new features  

---

## 🚀 Next Steps

1. ✅ Understand this file (MARKERS.md)
2. ✅ Read `.COPILOT_INSTRUCTIONS.md` for future edits
3. ✅ Try searching for a marker: `Ctrl+F → MARKER: PROFILE`
4. ✅ Make a test edit (e.g., change email)
5. ✅ Run `npm start` to verify
6. ✅ When adding code, add markers!

---

**Happy coding!** 🎉

*Keep this file updated when adding new markers*  
*All markers are searchable with Ctrl+F*  
*Build must pass before committing*
