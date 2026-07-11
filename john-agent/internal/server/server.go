package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// New creates the HTTP router and registers application routes.
func New() *gin.Engine {
	router := gin.Default()

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}
