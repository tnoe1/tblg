- [x] Database Interface
    - [x] Finish designing data model
    - [x] Finish writing posts.js
    - [x] Finish testing posts.js
    - [x] Finish writing comments.js
    - [x] Finish testing comments.js 
- [x] Decide if everything is a post or not (e.g. "about" and "contact")
    - No. Not everything is a post. There is no reason why somebody should
      need to comment on my "about" and "contact" pages.
- [x] Decide if backend is view-agnostic.
    - No. I want to do server-side rendering since it improves SEO (since
      HTML coming from server is pre-formed). Project should have a `views`
      directory containing html templates.
- [ ] Controllers (http routes)
    - [ ] Write RequestParser
    - [ ] Write RequestRouter
    - [ ] Package up Controller logic into `controllers/index.js`
- [ ] Services (business logic associated with http routes)
- [ ] Views (html templates)
