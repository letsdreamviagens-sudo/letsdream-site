# Let’s Dream Viagens (Vercel)

Este projeto já vem completo com:
- Busca de hotéis via Hotelbeds (`/api/hotelbeds-search`)
- Lista de resultados + botão **Selecionar**
- Carrinho (salvo no navegador) + WhatsApp orçamento
- Checkout PagBank (`/api/pagbank-checkout`) com redirecionamento

## Estrutura (IMPORTANTÍSSIMO)
No GitHub a estrutura tem que ficar ASSIM (as pastas na RAIZ do repositório):
- `index.html`
- `style.css`
- `js/` (frontend)
- `img/` (imagens)
- `api/` (APIs do Vercel — serverless functions)
- `vercel.json`

Se você colocar `api/` dentro de `js/`, o Vercel NÃO cria as APIs e vai dar **404**.

## Variáveis de ambiente no Vercel
No Vercel: Project → Settings → Environment Variables

### Hotelbeds
- `HOTELBEDS_API_KEY`
- `HOTELBEDS_SECRET`
- `HOTELBEDS_BASE_URL` (opcional)  
  - teste: `https://api.test.hotelbeds.com`  
  - produção: `https://api.hotelbeds.com`

### PagBank
- `PAGBANK_TOKEN`
- `PAGBANK_API_URL` (opcional)  
  - sandbox: `https://sandbox.api.pagseguro.com`
  - produção: `https://api.pagbank.com.br` (ou o que o PagBank informar no seu painel)

## Testes
- Hotelbeds: faça uma busca por **NYC** (ou “New York”).
- Orlando: digite **ORLANDO** (usa lat/lng por padrão).
- Carrinho: clique em **Selecionar**.
- PagBank: clique em **Finalizar** (id `payBtn`).

Se der erro, abra F12 → Console e veja `HOTELBEDS:` e `PAGBANK:`.
