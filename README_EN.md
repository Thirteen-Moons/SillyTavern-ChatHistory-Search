# 🔍 Chat History Search
<br>
A lightweight plugin built for SillyTavern.

Version: 1.4.0 | Author: Thirteen-Moons

---

## ⭐ Features
- Search past chat turns by keywords
- Quick jump to top / bottom of chat
- Jump directly to a specified chat turn number
- View context messages adjacent to a target entry

---

## ⚙ Panel Introduction
The quick access button is located inside the magic wand menu at the bottom-left of the message input box, labeled *"Chat History Search"*.
<br><br>

### 📍 Hotkey Bar
Click *"Chat History Search"* to open the shortcut panel.

- **1st Button**: Search chat history
- **2nd Button**: Jump to the top of loaded messages
  > The "top" refers to the range of chat turns you have set to load. To jump to turn 0, enter `0` in the search panel.
- **3rd Button**: Jump to the end of the latest message block
<br>

### 💾 Search Panel
- **Jump**: Enter a turn number to navigate directly to that entry
- **Search**: Input keywords to open the *"Search Results Page"*
  > Multiple keywords are supported; separate each keyword with a single space
<br>

### ✅ Search Results Page
- **Keyword Highlighting**: Keywords are highlighted with complementary colors, looks clean with any theme
- **Jump to Matching Entries**: Click any matched chat entry to jump straight to its position
- **Copy**: Copy the full text of the selected chat turn
- **Preview Adjacent Turns**: Open the *"Preview Page"* to smoothly view context messages before and after the target entry
<br>

### 📃 Preview Page
Scroll through surrounding messages freely; click the top-right button to copy the current chat entry.


<br><br>
---

## 🖊 Changelog
### v1.2.0
- **Feature Improvement**: Temporarily bypass SillyTavern's message load limits when jumping chat turns. Navigation is no longer restricted by load settings or the "Hide Assistant" toggle.
  > Click jump-to-bottom button to restore the original load limits.

- **UI Tweak**: Replaced default browser alert popups with custom modals
<br>

### v1.4.0
- **Full Architecture Refactor**: Split search interface, results view and preview view into separate modules
- **New Preview Page**: Smoothly browse adjacent chat turns without full page navigation
- **Mobile Display Improvements**: The interface now shifts upward automatically when the soft keyboard pops up on mobile, preventing the input box from being covered
- **Optimized Jump Logic**: Instead of temporarily loading all messages, the plugin only loads the minimal required range to reduce lag during jumps
<br>

---

## 📦 Installation Guide

Clone or download this repository into your SillyTavern extensions directory.

```
https://github.com/Thirteen-Moons/SillyTavern-ChatHistory-Search.git
```

<br>

---

## 📄 License

See [LICENSE](./LICENSE).

---

## Welcome 🤝

