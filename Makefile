
.PHONY: start build clean superClean updateLock push

uselessFiles := $(wildcard src/*.js)

start:
	npm start
	@$(MAKE) clean

build:
	npm run build
	@$(MAKE) clean

clean:
	rm -rf $(uselessFiles)

superClean: clean
	rm -rf dist

updateLock:
	npm update

push: updateLock
	git add .
	git commit -m "$(ARGS)"
	git push
