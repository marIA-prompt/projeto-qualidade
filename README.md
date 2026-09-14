# projeto-qualidade

Aplicativo de gestão de qualidade: registre e acompanhe verificações de qualidade
(quality checks) com um frontend em React e uma API em Express.

## Stack

- **Frontend:** React 18 + TypeScript + [Vite](https://vitejs.dev)
- **Backend:** Express 4 + TypeScript (executado com [tsx](https://github.com/privatenumber/tsx))
- **Testes:** [Vitest](https://vitest.dev) + Testing Library + Supertest
- **Qualidade:** ESLint (flat config) + `tsc`

O frontend (porta `5173`) faz proxy de `/api` para a API (porta `3001`), então
basta rodar os dois processos em desenvolvimento.

## Requisitos

- Node.js >= 20 (o repositório é validado com Node 22)

## Começando

```bash
npm ci        # instala as dependências a partir do package-lock.json
npm run dev   # sobe API (3001) e frontend (5173) juntos
```

Abra http://localhost:5173 e crie uma verificação de qualidade pelo formulário.

## Scripts

| Script | Descrição |
| --- | --- |
| `npm run dev` | Sobe API e frontend simultaneamente |
| `npm run dev:server` | Sobe apenas a API (com reload via `tsx watch`) |
| `npm run dev:web` | Sobe apenas o frontend (Vite) |
| `npm run build` | Type-check + build de produção do frontend |
| `npm run typecheck` | Type-check de todo o projeto (`tsc -b`) |
| `npm run lint` | ESLint |
| `npm test` | Suíte de testes (Vitest) |

## API

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Verificação de saúde |
| `GET` | `/api/checks` | Lista de verificações + resumo agregado |
| `POST` | `/api/checks` | Cria uma verificação (`title`, `area`, `status?`, `notes?`) |
| `GET` | `/api/summary` | Resumo agregado (total, aprovados, reprovados, pendentes, taxa) |

Os dados são mantidos em memória e reiniciam a cada boot da API (com dados de
exemplo pré-carregados).

## Estrutura

```
server/   API Express + store em memória + testes
src/      Frontend React (Vite) + testes de componente
shared/   Tipos TypeScript compartilhados entre frontend e backend
```

## Cloud Agent

O ambiente de desenvolvimento está descrito em `.cursor/environment.json`:
`npm ci` na instalação e dois terminais (`api`, `web`) em execução, com as portas
`3001` e `5173` expostas.
