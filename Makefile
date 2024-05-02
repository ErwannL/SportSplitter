
.PHONY: start build clean superClean updateLock push updateTailwind

uselessFiles := $(wildcard src/*.js)

start: updateTailwind
	npm start
	@$(MAKE) clean

build: updateTailwind
	npm run build
	@$(MAKE) clean

updateTailwind:
	npx tailwindcss -i ./src/css/input.css -o ./src/css/output.css

clean:
	rm -rf $(uselessFiles)

superClean: clean
	rm -rf dist

updateLock:
	npm update

push: updateLock superClean
	git add .
	git commit -m "$(ARGS)"
	git push
