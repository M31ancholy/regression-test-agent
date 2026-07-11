.PHONY: build test fmt run

build:
	go build -o bin/john-agent ./cmd/john-agent

test:
	go test ./...

fmt:
	gofmt -w ./cmd ./internal ./pkg

run:
	go run ./cmd/john-agent
