CC = cc
CPPFLAGS += $(shell pkg-config --cflags libmicrohttpd sqlite3)
CFLAGS ?= -O2 -g
CFLAGS += -std=c11 -Wall -Wextra -Wpedantic -Werror
LDLIBS += $(shell pkg-config --libs libmicrohttpd sqlite3)

build/math-server: src/main.c src/documents.c src/schema.h src/http.h
	mkdir -p build
	$(CC) $(CPPFLAGS) $(CFLAGS) src/main.c src/documents.c -o $@ $(LDLIBS)

.PHONY: run
run: build/math-server
	mkdir -p data
	./build/math-server
