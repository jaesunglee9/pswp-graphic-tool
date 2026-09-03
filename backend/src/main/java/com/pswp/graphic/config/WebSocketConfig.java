package com.pswp.graphic.config;

import com.pswp.graphic.websocket.CollaborationHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

/**
 * WebSocket configuration for real-time collaboration.
 *
 * <p>Clients connect to {@code ws://host:8080/api/collaboration/{documentId}}
 * to send and receive graphic object changes in real time.
 *
 * <p>The handshake interceptor extracts the {@code documentId} path variable
 * so the handler can route messages to the correct document room.
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CollaborationHandler collaborationHandler;

    public WebSocketConfig(CollaborationHandler collaborationHandler) {
        this.collaborationHandler = collaborationHandler;
    }

    /**
     * Tomcat defaults maxBinaryMessageBufferSize to 8192 bytes. A full-document
     * Yjs update exceeds that quickly (~45 KB at 200 shapes), and an oversized
     * frame closes the socket with 1009 and no useful diagnostic. Raise it.
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxBinaryMessageBufferSize(4 * 1024 * 1024);
        container.setMaxTextMessageBufferSize(64 * 1024);
        return container;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(collaborationHandler, "/api/collaboration/{documentId}")
                .addInterceptors(new HttpSessionHandshakeInterceptor())
                .setAllowedOrigins("*");
    }
}