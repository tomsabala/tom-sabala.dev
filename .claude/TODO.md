# TODO

## 1. Face Lift + Dark/Light Mode

- [x] Redesign the main website UI (modern look & feel)
- [x] Implement dark mode / light mode toggle
- [x] Persist theme preference (localStorage)
- [x] Ensure all pages and components respect the active theme

## 2. Navigation to Terminal from Main Website

- [x] Add a visible link/button to navigate to `/terminal` from the main site
- [x] Decide on placement (navbar, footer, easter egg, etc.)

## 3. Terminal Navigation Commands

- [x] Implement `cd` command (navigate a virtual filesystem)
- [x] Implement `ls` command (list contents of current virtual directory)
- [x] Implement `pwd` command (print current virtual directory)
- [x] Implement `exit` command (redirect back to the main website)
- [x] Define virtual filesystem structure (map site sections to directories/files)

## 4. Terminal UI Enhancements

- [x] Add blinking cursor
- [x] Improve theme support and theme switching UX
- [x] General terminal UI polish (scrolling, input behavior, responsiveness)

## 5. Project Deep Dive Page Enhancements

- [ ] Add README rendering (markdown) for each project
- [ ] Embed or link demo (video/live demo URL)
- [ ] Display architecture diagram (image or interactive)
- [ ] Tech stack breakdown section
- [ ] Challenges / lessons learned section

## 6. Terminal Info Rewrite

- [ ] Audit and rewrite all `info` command content (bio, skills, experience, etc.)
- [ ] Ensure content is accurate and up to date
- [ ] Polish formatting and structure of info output

## 7. GitHub Stats

- [ ] Fetch and display GitHub stats (contributions, repos, stars, languages)
- [ ] Decide on placement: main site section, terminal command, or both
- [ ] Handle API rate limiting / caching

## 8. Claude Status Page (Suggested Feature)

- [ ] Design a status/availability page powered by Claude (e.g. "currently working on X")
- [ ] Define data source (manual update, GitHub activity, or AI-generated summary)
- [ ] Integrate into main site or terminal as a command
