from typing import Any

def inline_keyboard(buttons: list[list[dict]]) -> dict:
    """Build inline keyboard payload for MAX bot."""
    return {
        "type": "inline_keyboard",
        "payload": {
            "buttons": buttons,
        },
    }


def btn(text: str, callback_data: str) -> dict:
    return {"type": "callback", "text": text, "payload": callback_data}


def url_btn(text: str, url: str) -> dict:
    return {"type": "link", "text": text, "url": url}


def language_keyboard() -> dict:
    return inline_keyboard([
        [btn("🇷🇺 Русский", "lang:RU"), btn("🇺🇿 O'zbek", "lang:UZ"), btn("🇹🇯 Тоҷикӣ", "lang:TJ")],
    ])


def main_menu_keyboard(lang: str) -> dict:
    labels = {
        "RU": ["🗺 Карта шкафчиков", "📷 Сканировать QR", "👤 Личный кабинет"],
        "UZ": ["🗺 Shkafchalar xaritasi", "📷 QR skanerlash", "👤 Shaxsiy kabinet"],
        "TJ": ["🗺 Харитаи қуттиҳо", "📷 Сканерзии QR", "👤 Кабинети шахсӣ"],
    }
    l = labels.get(lang, labels["RU"])
    return inline_keyboard([
        [btn(l[0], "menu:map")],
        [btn(l[1], "menu:scan_qr")],
        [btn(l[2], "menu:cabinet")],
    ])


def locker_keyboard(lang: str, locker_id: str, has_free_cells: bool) -> dict:
    if lang == "UZ":
        book_label = "📋 Bron qilish"
        queue_label = "⏳ Navbatga turish"
    elif lang == "TJ":
        book_label = "📋 Бронировон кардан"
        queue_label = "⏳ Ба навбат гузоштан"
    else:
        book_label = "📋 Забронировать"
        queue_label = "⏳ Встать в очередь"

    if has_free_cells:
        return inline_keyboard([
            [btn(book_label, f"book:locker:{locker_id}")],
        ])
    else:
        return inline_keyboard([
            [btn(queue_label, f"queue:join:{locker_id}")],
        ])


def confirm_booking_keyboard(lang: str, cell_id: str) -> dict:
    if lang == "UZ":
        yes, no = "✅ Tasdiqlash", "❌ Bekor qilish"
    elif lang == "TJ":
        yes, no = "✅ Тасдиқ кардан", "❌ Бекор кардан"
    else:
        yes, no = "✅ Подтвердить", "❌ Отмена"
    return inline_keyboard([
        [btn(yes, f"book:confirm:{cell_id}"), btn(no, "book:cancel")],
    ])


def session_keyboard(lang: str, session_id: str) -> dict:
    if lang == "UZ":
        end_label = "🔒 Yakunlash"
    elif lang == "TJ":
        end_label = "🔒 Хотима додан"
    else:
        end_label = "🔒 Завершить аренду"
    return inline_keyboard([
        [btn(end_label, f"session:end:{session_id}")],
    ])


def cabinet_keyboard(lang: str) -> dict:
    labels = {
        "RU": ["📋 Мои сессии", "💳 Мои карты", "🔔 Подписка", "⬅️ Назад"],
        "UZ": ["📋 Mening sessiyalarim", "💳 Mening kartalarim", "🔔 Obuna", "⬅️ Orqaga"],
        "TJ": ["📋 Сессияҳои ман", "💳 Картаҳои ман", "🔔 Обуна", "⬅️ Бозгашт"],
    }
    l = labels.get(lang, labels["RU"])
    return inline_keyboard([
        [btn(l[0], "cabinet:sessions"), btn(l[1], "cabinet:cards")],
        [btn(l[2], "cabinet:subscription")],
        [btn(l[3], "menu:main")],
    ])


def queue_join_keyboard(lang: str, locker_id: str) -> dict:
    if lang == "UZ":
        yes, no = "✅ Ha, qo'shish", "❌ Yo'q"
    elif lang == "TJ":
        yes, no = "✅ Бале, илова кун", "❌ Не"
    else:
        yes, no = "✅ Да, встать", "❌ Нет"
    return inline_keyboard([
        [btn(yes, f"queue:confirm:{locker_id}"), btn(no, "menu:main")],
    ])


def debt_keyboard(lang: str) -> dict:
    if lang == "UZ":
        label = "💳 Qarzni to'lash"
    elif lang == "TJ":
        label = "💳 Пардохти қарз"
    else:
        label = "💳 Погасить долг"
    return inline_keyboard([
        [btn(label, "debt:pay")],
    ])
