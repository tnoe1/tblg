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
- [x] Services (business logic associated with http routes)
    - No-op for now.
- [ ] Controllers (http routes)
    - http server setup shown in controller.js at the moment. Can ping
      it with a curl request such as:
          ```bash
          curl -X POST "http://127.0.0.1:3009/tacobell?nachos=false&hi=hello" \
               -H "Content-Type: text/plain" \
               -d 'hi tblg'
          ```
    - [x] Move body stream consolidation into `RequestParser`.
    - [x] Write RequestParser
    - [ ] Write RequestRouter
        - [x] Write test route
        - [ ] Write route for serving home page
        - [ ] Write route for serving indexed (?) posts
    - [ ] Package up Controller logic into `controllers/index.js`
- [ ] Views (html templates)
    - [ ] Finish writing `load_home()` in ServiceInterface.js 
          (and `serve_home()` in RequestRouter.js)
- [ ] Write service that checks the views folder for posts and uses that to
      curate list available posts viewable by user.
    - [ ] Add parser for enabling hidden (in-progress) posts that aren't
          viewable.
- [ ] Put TLS (https) concern at infrastructure layer via NGINX
