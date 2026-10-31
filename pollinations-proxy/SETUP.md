# Pollinations proxy для DonorGram

Этот Worker держит секретный ключ `sk_...` на сервере. Не вставляй его в GitHub, HTML или настройки браузера.

## 1. Создай Worker в Cloudflare

1. Открой https://dash.cloudflare.com/ и перейди в Workers & Pages.
2. Создай Worker с именем `donorgram-pollinations`.
3. Замени содержимое Worker кодом из файла `worker.js` (или разверни через Wrangler с этим каталогом).
4. В настройках Worker → Variables and Secrets добавь Secret:
   - Name: `POLLINATIONS_API_KEY`
   - Value: твой новый ключ `sk_...`
5. Добавь второй Secret:
   - Name: `DONORGRAM_PROXY_TOKEN`
   - Value: длинный случайный пароль (не используй пароль от других сервисов; можно сгенерировать командой `openssl rand -hex 32`).
6. Подключи Rate Limiting binding с именем `RATE_LIMITER` (30 запросов в минуту на IP). Файл `wrangler.toml` содержит пример настройки для Wrangler.
7. Сохрани и разверни Worker.

## 2. Подключи DonorGram

1. Открой https://troll2281488.github.io/Don/
2. Настройки → DonAI.
3. Вставь адрес Worker вида `https://donorgram-pollinations.<твой-аккаунт>.workers.dev`.
4. В поле «Личный пароль доступа к Worker» вставь значение Secret `DONORGRAM_PROXY_TOKEN` (это отдельный пароль, не Pollinations API key).
5. Нажми «Проверить подключение», затем сохрани настройки.

## 3. Команды DonAI

- Обычный текст — чат с выбранной моделью.
- `/image описание картинки` — генерация изображения.
- `/speak текст для озвучки` — генерация речи.
- Прикрепи аудиофайл кнопкой скрепки и отправь `/transcribe` — распознавание речи.

## Безопасность

Worker проверяет GitHub Pages origin, личный токен доступа и ограничивает частоту запросов через Rate Limiting. Токен хранится в localStorage на твоём устройстве, поэтому не отправляй его другим людям и не добавляй в GitHub. Это снижает риск злоупотреблений, но публичный endpoint всё равно может быть атакован; следи за лимитами и балансом Pollinations. Для публичного многопользовательского сервиса нужен полноценный вход пользователей и отдельные квоты на каждого пользователя.
