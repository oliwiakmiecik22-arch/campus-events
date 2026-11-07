# Campus Events — notatki do prezentacji

## 1. Co zbudowałam

Campus Events pozwala przeglądać wydarzenia, sprawdzać wolne miejsca i rejestrować uczestników.
Frontend jest napisany w Vue, a API w Express. Działają razem pod jednym adresem:
https://campus-events-api-0omf.onrender.com.

## 2. Architektura

Przepływ żądania wygląda tak:

```text
Vue → route + walidacja → controller → service → repository → model Sequelize → baza
```

- Route wybiera walidację i kontroler.
- Controller obsługuje HTTP i kod odpowiedzi.
- Service zawiera reguły aplikacji, ale nie zna Expressa ani Sequelize.
- Repository jako jedyne korzysta z modeli.
- Model opisuje tabelę i relacje w bazie.

Dzięki temu każda warstwa ma jedno proste zadanie i łatwiej ją testować.

## 3. Rejestracja i e-mail

Przy rejestracji aplikacja:

1. sprawdza wydarzenie, duplikat adresu i pojemność;
2. zapisuje rejestrację w bazie;
3. od razu unieważnia odpowiednie dane cache;
4. dopiero potem próbuje wysłać e-mail przez Brevo HTTPS.

Najważniejszy jest zapis w bazie. Brak konfiguracji Brevo, błąd providera albo timeout nie usuwa
rejestracji i nie zmienia odpowiedzi `201`. Timeout ma domyślnie około 3 sekund i anuluje żądanie
przez `AbortController`. Nieudane e-maile nie są ponawiane.

## 4. Cache

Cache przechowuje udane odpowiedzi GET przez maksymalnie 5 sekund i ma do 100 wpisów. Po utworzeniu,
zmianie lub usunięciu wydarzenia oraz po rejestracji odpowiednie klucze są usuwane od razu.

Cache ma licznik generacji. Jeżeli odczyt rozpoczął się przed zmianą danych, nie może po zmianie
zapisać starego wyniku z powrotem. Cache działa tylko w jednym procesie i znika po restarcie.

## 5. Baza i wdrożenie

- Lokalnie i w testach używany jest SQLite.
- Produkcja używa Neon PostgreSQL z TLS i weryfikacją certyfikatu.
- Render buduje Vue, a Express serwuje gotowy frontend i API pod jednym adresem.
- Brevo jest wywoływane przez HTTPS, ponieważ Render Free blokuje porty SMTP.
- Sekrety są zapisane tylko w panelu Render jako zmienne środowiskowe.

Ręcznie sprawdziłam działanie rejestracji i otrzymanie prawdziwego e-maila. Następnie zrestartowałam
usługę Render: rejestracja i liczba zajętych miejsc pozostały bez zmian, więc trwałość po restarcie
została potwierdzona.

## 6. Testy i ograniczenia

- 39 testów API przeszło.
- 10 testów frontendowych przeszło.
- Produkcyjny build przeszedł.

Ograniczenia: cache nie jest współdzielony między procesami, nieudane e-maile nie są ponawiane,
darmowy Render może mieć zimny start, a testy automatyczne używają SQLite zamiast prawdziwego Neon.
Nie zapisano osobnego testu trwałości istniejących danych podczas kolejnego redeployu.

## 7. AI i źródła

AI pomogło przy refaktoryzacji, testach, przeglądzie i dokumentacji. Kod został sprawdzony testami,
a wdrożenie i testy na żywo wykonałam ręcznie. Odpowiedzi Stack Overflow o `AbortController`,
invalidacji cache i liczniku wersji zostały użyte dopiero podczas końcowego przeglądu dokumentacji.
