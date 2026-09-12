# Развёртывание на GitHub

Проект полностью готов к добавлению в репозиторий GitHub. Выполните следующие шаги:

## На вашем MacBook

### 1. Скопируйте папку `chess` с сервера

```bash
# Если у вас уже есть локальный клон репозитория CRM:
scp -r root@capable-violet.aeza.network:/root/chess ~/repos/CRM/

# Или используйте Termius/другой SSH-клиент для загрузки папки
```

### 2. Перейдите в папку репозитория

```bash
cd ~/repos/CRM
```

### 3. Добавьте папку chess в git

```bash
git add chess/
git status  # Проверьте, что все файлы добавлены
```

### 4. Сделайте commit

```bash
git commit -m "Добавить приложение 'Шахматы: Мультивселенная'

- Полная реализация шахматной игры с поддержкой PvP и PvE
- 3 визуальные темы: классика, Animal Hospital, Тачки
- ИИ-противник с тремя уровнями сложности
- Универсальное управление: мышь и сенсорные экраны
- Адаптивный дизайн (HTML5 + CSS3 + Tailwind + JavaScript)"
```

### 5. Отправьте на GitHub

```bash
git push origin main
```

## Проверка

После push войдите на **github.com/vladmon-1981/CRM** и убедитесь, что:
- ✅ Папка `chess/` видна в main ветке
- ✅ Все файлы на месте (index.html, js/, css/, README.md)
- ✅ README отображается корректно

## Запуск приложения

### Локально (для тестирования)

```bash
cd chess
python3 -m http.server 8000
# Откройте http://localhost:8000 в браузере
```

### На веб-сервере

1. Скопируйте папку на сервер:
   ```bash
   scp -r chess/ root@capable-violet.aeza.network:/var/www/html/
   ```

2. Откройте в браузере:
   ```
   http://capable-violet.aeza.network/chess/
   ```

## Структура в репозитории

После push в GitHub репозиторий будет выглядеть так:

```
CRM/
├── chess/                 ← Новая папка с игрой
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   ├── chess-app.js
│   │   ├── ai.js
│   │   ├── themes.js
│   │   └── sounds.js
│   ├── README.md
│   ├── DEPLOYMENT.md      ← Этот файл
│   ├── .gitignore
│   └── package.json
├── ... (остальные файлы CRM)
```

---

**Готово!** Проект успешно добавлен в GitHub 🎉
