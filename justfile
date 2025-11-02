# Build both Tailwind CSS and Zola
build:
    tailwindcss -i ./input.css -o ./static/style.css --minify
    zola build

# Watch both Tailwind CSS and Zola in parallel
watch:
    #!/usr/bin/env bash
    tailwindcss -i ./input.css -o ./static/style.css --watch &
    zola serve
