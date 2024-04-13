
.PHONY: start build clean superClean

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
