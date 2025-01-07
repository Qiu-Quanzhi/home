ffmpeg -i ---  -compression_level 0 -quality 80 -preset photo -vf scale=512:341 ---

# V3 迁移指南

1. 不要忘记清理 Hexo 缓存。
2. 你应该更改的：
    - links/index.md:
        1. 添加 `data: links` 来重新指向 `links.yaml` 数据文件。
        2. 添加 `banner: true`，默认隐藏 banner。
    - essay/index.md:
        1. 更改为 `type: brevity`。
    - equipment/index.md:
        1. 更改为 `type: kit`。
        2. 添加 `data: equipment` 来重新指向 `equipment.yaml` 数据文件。
    - tlink/index.md:
        1. `tlinks` 现已废弃。
        2. 更改为 `type: links`，移除了Banner。
        