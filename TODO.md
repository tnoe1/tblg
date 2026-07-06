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
- [x] Controllers (http routes)
    - http server setup shown in controller.js at the moment. Can ping
      it with a curl request such as:
          ```bash
          curl -X POST "http://127.0.0.1:3009/tacobell?nachos=false&hi=hello" \
               -H "Content-Type: text/plain" \
               -d 'hi tblg'
          ```
    - [x] Move body stream consolidation into `RequestParser`.
    - [x] Write RequestParser
    - [x] Write RequestRouter
        - [x] Write test route
        - [x] Write route for serving home page
        - [x] Write route for serving posts
            - [x] How do we write posts? What is the actual workflow?
                - Content column in posts table should be the html rendering of
                a .md file in the `views/posts` folder. On startup, the
                existing .md files will be compared with their current check-
                sums in the db and if there's change, their checksum and html
                will be updated in the database. On request (after 
                initialization), the most recent version of the rendered
                requested posts will be inserted into the post template and
                sent to the client. After a new post has been added, restart
                the server and refresh the browser and it should show up.
            - [x] Write test post tracer.
                - [x] Implement asset serving in public directory (w/ security)
                - [x] Change db schema to incorporate `.md` checksums and
                relative `.md` path into posts table.
                    - [x] Add checksum comp. (`lib/compute_checksum.js`)
                    - [x] Update PostInterface accordingly
                        - [x] Update `create_post()`
                        - [x] Update `update_post()`
                    - [x] Update posts.test.js and comments.test.js accordingly
                - [x] Implement `views/posts` directory scan-and-ingest
                    - [x] Iterate through directory and scrutinize checksum
                    for posts already existing in db, and if post is updated
                    translate to html and ingest into `content` column. If post
                    is _new_, compute checksum, translate into `.html` and 
                    ingest checksum and `.html` into new row in posts.
                        - [x] Finish `synchronize_posts()` method in
                        `PostSyncer`.
                            - [x] canned `.md` to `.html` transpiler 
                            or roll-your-own? canned
                            - [x] Test updating desynced post
                            - [x] Test creating new posts from md on disk
                            - [x] Test recovering md from html in db
                                - [x] Fix bug where math isn't recovered 
                                correctly
                - [x] render post html with assets in it (e.g. photos)
                - [x] render post html with math in it
    - [x] Package up Controller logic into `controllers/index.js`
- [x] Add "@!title" tag to metadata parser and title column to posts 
    - [x] Add to parser
    - [x] Add to schema
    - [x] Add to PostInterface
        - [x] Make every item in `update_post` other than id and `md_path`
        truly optional.
- [x] Update tests for posts and comments
- [x] Add a meta-description column to posts table for SEO (e.g. "A guide by 
      ML Engineer Thomas Noel on reducing latency during large language model 
      inference.")
- [ ] Views (html templates)
    - [x] Finish writing `load_home()` in ServiceInterface.js 
          (and `serve_home()` in RequestRouter.js)
    - [x] Figure out view template for posts
        - Posts will be `.md` files that get parsed into html
    - [ ] Inject meta-description into html
    - [ ] Figure out site layout
        - [ ] Polish up home page
        - [ ] Add post links to home page
            - [ ] Write method that checks the database for posts and uses that to
                  curate list available posts viewable by user.
                - [ ] Add parser for enabling hidden (in-progress) posts that aren't
                      viewable.
            - [ ] Make post viewing interface congruent with home (i.e. make
            website seem consistent across views)
                - [ ] Polish post template wrapper html for easy navigation
- [ ] Put TLS (https) concern at infrastructure layer via NGINX
- [ ] Dockerize
- [ ] Deploy (AWS?)

For future versions:
- [ ] Add downgrade logic to data model definition
