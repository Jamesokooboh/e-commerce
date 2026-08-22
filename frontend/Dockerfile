# Stage 1: Build the React application
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build


# Stage 2: Serve the static files with unprivileged Nginx
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

USER root

COPY --chown=101:101 nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/build /usr/share/nginx/html
COPY docker-entrypoint.d/20-env-config.sh /docker-entrypoint.d/20-env-config.sh
RUN chmod +x /docker-entrypoint.d/20-env-config.sh

USER 101

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]