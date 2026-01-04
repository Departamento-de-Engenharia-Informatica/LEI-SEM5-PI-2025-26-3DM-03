## Docker disk cleanup (VM)

If the self-hosted runner VM fails with `no space left on device` during `docker pull`, run a cleanup before pulling:

```sh
docker ps -a
docker system df

# Safe-ish cleanup for CI runners (removes stopped containers, dangling images, build cache)
docker container prune -f
docker image prune -af
docker builder prune -af

# Optional (more aggressive): removes unused volumes
# docker volume prune -f

docker system df
```
