package main

import (
	"log"

	"john-agent/internal/server"
)

func main() {
	if err := server.New().Run(); err != nil {
		log.Fatal(err)
	}
}
