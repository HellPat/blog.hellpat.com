# Build both Tailwind CSS and Zola
build:
    tailwindcss -i ./styles.css -o ./static/styles.css --minify
    zola build

# Watch both Tailwind CSS and Zola in parallel
watch:
    #!/usr/bin/env bash
    tailwindcss -i ./styles.css -o ./static/styles.css --watch &
    zola serve
