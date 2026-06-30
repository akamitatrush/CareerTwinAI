// Provider de fallback: catalogo curado de vagas ILUSTRATIVAS.
// Sempre marcado como source: "fixtures" → a UI mostra o chip "Ilustrativo".
// Empresas ficticias plausiveis; descricoes ricas em skills da taxonomy
// (lib/skills-taxonomy.js) pra que matchScore consiga calcular % de aderencia
// e a UI nao mostre tela vazia em ambiente sem ADZUNA/JOOBLE configurado.
//
// NUNCA retornamos vagas com descricao "vazia de skills" — isso fazia o
// filtro `match > 0` na rota /api/opportunities apagar tudo e gerar empty state.
//
// Bug historico: ate v0.3.0 cada fixture vinha como "Vaga ILUSTRATIVA para X"
// sem nenhuma skill extraivel, gerando match=0 em 100% dos casos.

import { NOISE_TOKENS } from "../role-utils";

const CATALOG = [
  // === Backend / Engenharia ===
  {
    id: "fix-be-pleno-1",
    areas: ["backend", "back-end", "desenvolvedor", "engineer", "engenheiro", "dev", "software"],
    titulo: "Engenheiro(a) de Software Backend Pleno",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 8000,
    salarioMax: 13000,
    descricao:
      "Buscamos pessoa engenheira backend pleno pra trabalhar com Node.js, TypeScript, PostgreSQL e arquitetura de microsservicos em AWS. Conhecimento em REST APIs, Docker, Kubernetes, Git e testes automatizados e essencial. Metodologia agile (scrum). Ingles intermediario e diferencial.",
  },
  {
    id: "fix-be-senior-1",
    areas: ["backend", "back-end", "desenvolvedor", "engineer", "engenheiro", "dev", "software"],
    titulo: "Engenheiro(a) de Software Backend Senior",
    empresa: "Acme do Brasil",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 14000,
    salarioMax: 22000,
    descricao:
      "Vaga senior pra liderar tecnicamente um time de backend. Stack: Go, gRPC, PostgreSQL, Kafka, AWS (EKS, RDS, Lambda), Docker, Kubernetes. Experiencia em desenho de sistemas distribuidos, observabilidade e mentoria. Ingles fluente requisito. Lideranca tecnica e cultura de code review.",
  },
  {
    id: "fix-be-java-1",
    areas: ["backend", "java", "desenvolvedor", "dev", "engenheiro"],
    titulo: "Desenvolvedor(a) Backend Java Pleno",
    empresa: "Banco Andorinha",
    local: "Sao Paulo, SP",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Backend pleno com Java (Spring Boot), PostgreSQL, AWS, Docker e Kubernetes. Experiencia em REST APIs, mensageria (Kafka/RabbitMQ), testes (JUnit), Git e CI/CD. Setor bancario, ambiente agile (scrum).",
  },
  {
    id: "fix-be-kotlin-1",
    areas: ["backend", "kotlin", "mobile", "desenvolvedor", "dev"],
    titulo: "Desenvolvedor(a) Backend Kotlin Pleno",
    empresa: "Estudio Caju",
    local: "Remoto (Brasil)",
    salarioMin: 9500,
    salarioMax: 14500,
    descricao:
      "Backend pleno com Kotlin (Ktor/Spring), PostgreSQL, GCP (Cloud Run, BigQuery), Docker e Kubernetes. Familiar com microsservicos, REST APIs, mensageria, testes automatizados e Git.",
  },
  {
    id: "fix-be-go-1",
    areas: ["backend", "go", "golang", "engenheiro", "dev"],
    titulo: "Engenheiro(a) Backend Go Senior",
    empresa: "Cooperativa Verde",
    local: "Curitiba, PR (Hibrido)",
    salarioMin: 13000,
    salarioMax: 20000,
    descricao:
      "Senior em Go com experiencia em servicos distribuidos, gRPC, PostgreSQL, Kafka, Docker, Kubernetes e AWS. Cultura de testes, observabilidade (Prometheus/Grafana) e lideranca tecnica. Ingles fluente.",
  },
  {
    id: "fix-be-junior-1",
    areas: ["backend", "back-end", "desenvolvedor", "junior", "engenheiro", "dev"],
    titulo: "Desenvolvedor(a) Backend Junior",
    empresa: "Pirilampo Energia",
    local: "Belo Horizonte, MG (Hibrido)",
    salarioMin: 4500,
    salarioMax: 7000,
    descricao:
      "Vaga junior pra time de plataforma. Stack: Node.js, JavaScript, TypeScript, PostgreSQL, AWS basico, Docker, Git e REST APIs. Buscamos pessoa com vontade de aprender, cultura agile (scrum/kanban) e bom trabalho em equipe. Ingles tecnico pra leitura. Mentoria estruturada e plano de carreira.",
  },
  {
    id: "fix-be-lead-1",
    areas: ["backend", "lead", "lideranca", "engenheiro", "engineer", "principal"],
    titulo: "Principal Engineer Backend",
    empresa: "Cardume Fintech",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 22000,
    salarioMax: 32000,
    descricao:
      "Lead engineer com 10+ anos pra definir arquitetura de plataforma. Stack: Go, Node.js, TypeScript, AWS (EKS, Lambda, RDS), Kubernetes, Kafka, PostgreSQL e observabilidade. Lideranca tecnica multi-squad, mentoria de seniors, decisao de tradeoffs e parceria com produto. Gestao de pessoas (people management) leve. Ingles fluente.",
  },

  // === Frontend ===
  {
    id: "fix-fe-pleno-1",
    areas: ["frontend", "front-end", "react", "desenvolvedor", "dev", "web"],
    titulo: "Desenvolvedor(a) Frontend Pleno",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 7500,
    salarioMax: 12000,
    descricao:
      "Frontend pleno com React, Next.js, TypeScript, JavaScript e CSS moderno. Experiencia em consumo de REST APIs, testes (Jest, React Testing Library), Git, design system e acessibilidade. Cultura agile (scrum/kanban).",
  },
  {
    id: "fix-fe-senior-1",
    areas: ["frontend", "front-end", "react", "desenvolvedor", "dev", "web"],
    titulo: "Desenvolvedor(a) Frontend Senior",
    empresa: "Estudio Caju",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 12000,
    salarioMax: 18000,
    descricao:
      "Vaga senior com React, Next.js, TypeScript e foco em performance. Experiencia com design system, testes E2E (Playwright/Cypress), CI/CD, acessibilidade (WCAG), Git e mentoria de devs juniores. Ingles avancado.",
  },
  {
    id: "fix-fe-junior-1",
    areas: ["frontend", "react", "desenvolvedor", "junior", "dev", "web"],
    titulo: "Desenvolvedor(a) Frontend Junior",
    empresa: "Bossa Studio",
    local: "Porto Alegre, RS (Remoto)",
    salarioMin: 4000,
    salarioMax: 6500,
    descricao:
      "Frontend junior com React, JavaScript, TypeScript, HTML/CSS, Next.js basico, Git e consumo de REST APIs. Familiaridade com design system, acessibilidade e testes (Jest) sao diferenciais. Cultura agile (scrum), code review e mentoria diaria. Ingles tecnico pra leitura de documentacao.",
  },
  {
    id: "fix-fullstack-pleno-1",
    areas: ["fullstack", "full-stack", "full stack", "desenvolvedor", "dev", "engenheiro"],
    titulo: "Desenvolvedor(a) Fullstack Pleno",
    empresa: "Acme do Brasil",
    local: "Remoto (Brasil)",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Fullstack pleno com Node.js, TypeScript, React, Next.js, PostgreSQL e AWS. Confortavel com REST APIs, Docker, Git, CI/CD e testes automatizados. Ambiente agile (scrum), code review e cultura de qualidade.",
  },
  {
    id: "fix-fullstack-junior-1",
    areas: ["fullstack", "full-stack", "desenvolvedor", "junior", "dev"],
    titulo: "Desenvolvedor(a) Fullstack Junior",
    empresa: "Quero Aprender",
    local: "Remoto (Brasil)",
    salarioMin: 4500,
    salarioMax: 6800,
    descricao:
      "Fullstack junior com Node.js, JavaScript, TypeScript basico, React, PostgreSQL e Git. Familiar com REST APIs, Docker basico e testes. Cultura agile (scrum), mentoria semanal, pair programming. Ingles tecnico pra leitura. Plano de carreira ate pleno em 18 meses.",
  },
  {
    id: "fix-fullstack-senior-1",
    areas: ["fullstack", "full-stack", "desenvolvedor", "engenheiro", "senior"],
    titulo: "Desenvolvedor(a) Fullstack Senior",
    empresa: "Hummingbird Tech",
    local: "Florianopolis, SC (Hibrido)",
    salarioMin: 14000,
    salarioMax: 21000,
    descricao:
      "Fullstack senior end-to-end com Node.js, TypeScript, React, Next.js, PostgreSQL, AWS (EKS, RDS, Lambda), Docker, Kubernetes e Git. Lideranca tecnica em squad de produto, mentoria, code review, design de APIs (REST), testes automatizados (Jest, Playwright) e cultura agile (scrum). Ingles fluente requisito.",
  },

  // === Dados / Analytics / DS / ML ===
  {
    id: "fix-data-pleno-1",
    areas: ["dados", "data", "analista", "analyst", "analise"],
    titulo: "Analista de Dados Pleno",
    empresa: "Banco Andorinha",
    local: "Sao Paulo, SP",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "Analista de dados com SQL avancado, Python (Pandas, NumPy), Power BI ou Looker, ETL e modelagem dimensional. Conhecimento em data warehouse (Snowflake/BigQuery) e dbt e diferencial. Cultura analytics, storytelling com dados.",
  },
  {
    id: "fix-data-eng-pleno-1",
    areas: ["dados", "data", "engenheiro", "engineer", "engineering"],
    titulo: "Engenheiro(a) de Dados Pleno",
    empresa: "Cooperativa Verde",
    local: "Remoto (Brasil)",
    salarioMin: 10000,
    salarioMax: 15000,
    descricao:
      "Data engineer pleno com SQL avancado, Python, Spark (PySpark), Airflow, dbt e GCP (BigQuery, Dataflow) ou AWS. Experiencia em pipelines ETL/ELT, data lake/warehouse, modelagem dimensional, Docker e Git.",
  },
  {
    id: "fix-data-eng-senior-1",
    areas: ["dados", "data", "engenheiro", "engineer", "engineering"],
    titulo: "Engenheiro(a) de Dados Senior",
    empresa: "Norte Tecnologia",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 14000,
    salarioMax: 21000,
    descricao:
      "Data engineering senior com SQL, Python, Spark, Airflow, dbt, AWS (Glue, S3, Redshift, EMR), Docker e Kubernetes. Lideranca tecnica em pipelines de larga escala, mentoria, code review e parceria com Data Science. Ingles fluente.",
  },
  {
    id: "fix-data-junior-1",
    areas: ["dados", "data", "analista", "analyst", "junior"],
    titulo: "Analista de Dados Junior",
    empresa: "Mata Atlantica Saude",
    local: "Recife, PE (Hibrido)",
    salarioMin: 3800,
    salarioMax: 6000,
    descricao:
      "Junior em analise de dados com SQL, Python (Pandas), Excel avancado, Power BI ou Looker Studio. Experiencia em ETL simples, dashboards, storytelling com dados e parceria com areas de negocio. Familiaridade com Git e dbt sao diferenciais. Cultura agile (scrum), mentoria estruturada. Ingles tecnico.",
  },
  {
    id: "fix-data-eng-senior-2",
    areas: ["dados", "data", "engenheiro", "engineering", "lead", "senior"],
    titulo: "Engenheiro(a) de Dados Senior - Plataforma",
    empresa: "Cardume Fintech",
    local: "Remoto (Brasil)",
    salarioMin: 16000,
    salarioMax: 24000,
    descricao:
      "Engenheiro(a) de dados senior para liderar pipeline de ingestao em Airflow + Kafka, modelagem em dbt + Snowflake e governanca de qualidade (Great Expectations). Experiencia com Python, SQL avancado, AWS (S3, Glue, EMR), Spark, Docker, Kubernetes, Git, mentoria de equipe e comunicacao com areas de negocio. Lideranca tecnica de squad de dados. Ingles fluente.",
  },
  {
    id: "fix-ds-pleno-1",
    areas: ["data science", "cientista", "ml", "machine learning", "ia", "ai"],
    titulo: "Cientista de Dados Pleno",
    empresa: "Cooperativa Verde",
    local: "Curitiba, PR (Hibrido)",
    salarioMin: 10000,
    salarioMax: 15000,
    descricao:
      "Data scientist com Python (Pandas, scikit-learn), SQL, machine learning, estatistica aplicada e LLMs. Experiencia em modelos preditivos, MLOps, AWS, Docker e Git. Vaga atua em projetos de risco e credito. Ingles intermediario.",
  },
  {
    id: "fix-ds-senior-1",
    areas: ["data science", "cientista", "ml", "machine learning", "ia", "ai"],
    titulo: "Cientista de Dados Senior",
    empresa: "Acme do Brasil",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 15000,
    salarioMax: 23000,
    descricao:
      "Senior em data science com Python, SQL, machine learning avancado, LLM/NLP, Spark, AWS (SageMaker) e MLOps. Lideranca de projetos end-to-end, mentoria, parceria com produto e ingles fluente. Cultura experimentacao A/B.",
  },
  {
    id: "fix-ml-eng-1",
    areas: ["ml", "machine learning", "engenheiro", "engineer", "ia", "ai"],
    titulo: "Engenheiro(a) de Machine Learning Pleno",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 11000,
    salarioMax: 17000,
    descricao:
      "ML engineer com Python, TensorFlow/PyTorch, machine learning, LLM, Docker, Kubernetes, AWS e MLOps. Experiencia em deploy de modelos em producao, feature stores, monitoramento e A/B testing. SQL e Git fluentes.",
  },
  {
    id: "fix-bi-pleno-1",
    areas: ["bi", "business intelligence", "analytics", "dados", "data"],
    titulo: "Analista de BI Pleno",
    empresa: "Banco Andorinha",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 7500,
    salarioMax: 12000,
    descricao:
      "BI pleno com SQL avancado, Power BI, Tableau, Looker e Excel avancado. Experiencia em modelagem dimensional, ETL, dashboards executivos e storytelling com dados. Familiar com Python e dbt e diferencial.",
  },

  // === AI / LLM Engineering (NOVO) ===
  {
    id: "fix-ai-eng-pleno-1",
    areas: ["ai", "ia", "llm", "ai engineer", "engenheiro", "machine learning", "ml"],
    titulo: "AI Engineer Pleno",
    empresa: "Hummingbird Tech",
    local: "Remoto (Brasil)",
    salarioMin: 12000,
    salarioMax: 18000,
    descricao:
      "AI engineer pleno pra construir aplicacoes com LLM (large language model) em producao. Stack: Python, TypeScript, LangChain/LlamaIndex, OpenAI/Anthropic APIs, vector databases (Pinecone, pgvector), RAG, prompt engineering, fine-tuning, MLOps, AWS, Docker, Kubernetes, Git. Familiar com machine learning, observabilidade de modelos e A/B testing. Ingles fluente.",
  },
  {
    id: "fix-ml-platform-senior-1",
    areas: ["ml", "machine learning", "platform", "engenheiro", "engineer", "ai", "ia", "lead"],
    titulo: "ML Platform Engineer Senior",
    empresa: "Cardume Fintech",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 18000,
    salarioMax: 28000,
    descricao:
      "Senior em ML platform pra construir infra de machine learning e LLMs em larga escala. Stack: Python, Go, Kubernetes, AWS (SageMaker, EKS, S3), Airflow, MLflow, feature stores, model registry, observabilidade, Docker, Terraform e Git. Lideranca tecnica, mentoria, parceria com data science e cultura DevSecOps. Ingles fluente.",
  },

  // === Produto / Design ===
  {
    id: "fix-pm-pleno-1",
    areas: ["produto", "product", "pm", "product manager"],
    titulo: "Product Manager Pleno",
    empresa: "Acme do Brasil",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 12000,
    salarioMax: 18000,
    descricao:
      "Product manager pleno com responsabilidade por roadmap, descoberta de produto, priorizacao (RICE, MoSCoW), metricas (north star, AARRR), entrevistas com usuarios, analytics (SQL, Looker, Excel), parceria com UX e engineering, agile (scrum). Familiar com Git pra acompanhar releases. Ingles fluente requisito. Product management end-to-end.",
  },
  {
    id: "fix-pm-senior-1",
    areas: ["produto", "product", "pm", "product manager"],
    titulo: "Product Manager Senior",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 16000,
    salarioMax: 24000,
    descricao:
      "Senior product manager com track record em gestao de produto digital, lideranca de squad, OKRs, discovery, analytics (SQL, Looker), experimentacao A/B e parceria com UX, dados e engineering. Ingles fluente. Lideranca de pessoas como diferencial.",
  },
  {
    id: "fix-pm-senior-2",
    areas: ["produto", "product", "pm", "product manager", "senior", "lideranca"],
    titulo: "Senior Product Manager - Growth",
    empresa: "Carioca Midia",
    local: "Rio de Janeiro, RJ (Hibrido)",
    salarioMin: 17000,
    salarioMax: 25000,
    descricao:
      "Senior product manager em squad de growth. Responsavel por discovery, experimentacao A/B, funil AARRR, OKRs, roadmap, analytics (SQL, Looker, GA4), CRM e parceria com marketing, UX e dados. Gestao de pessoas (people management) leve, mentoria de PMs juniores, agile (scrum). Ingles fluente requisito.",
  },
  {
    id: "fix-ux-pleno-1",
    areas: ["design", "ux", "ui", "product designer", "designer"],
    titulo: "Product Designer Pleno",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 8500,
    salarioMax: 13000,
    descricao:
      "Product designer com Figma, design system, pesquisa qualitativa em UX, prototipagem e testes de usabilidade. Familiar com WCAG, acessibilidade, design tokens, HTML/CSS basico, colaboracao com engenharia (Git/GitHub), product management e cultura agile (scrum). Ingles intermediario. Parceria com product manager (PM) no dia a dia.",
  },
  {
    id: "fix-ux-senior-1",
    areas: ["design", "ux", "ui", "product designer", "designer"],
    titulo: "Product Designer Senior",
    empresa: "Estudio Caju",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 13000,
    salarioMax: 19000,
    descricao:
      "Senior em UX/UI com Figma avancado, design system, pesquisa quali/quanti, prototipagem, design ops, gestao de pessoas (people management/lideranca de time de design), mentoria, agile (scrum) e parceria estrategica com PM (product manager). Familiar com Git, design tokens e analytics (Looker). Ingles avancado.",
  },
  {
    id: "fix-ux-researcher-1",
    areas: ["ux", "researcher", "pesquisador", "research", "design", "user experience"],
    titulo: "UX Researcher Pleno",
    empresa: "Mundo Plural Educacao",
    local: "Remoto (Brasil)",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "UX researcher pleno pra liderar discovery de produto. Pesquisa qualitativa (entrevistas, etnografia), quantitativa (surveys, analytics no Looker e GA4), testes de usabilidade, jornadas, personas e parceria com PM (product manager / product management), UX/UI design e dados (SQL basico, Excel). Familiar com Figma, Miro, Git e cultura agile (scrum). Ingles avancado.",
  },

  // === DevOps / SRE / Plataforma ===
  {
    id: "fix-devops-pleno-1",
    areas: ["devops", "sre", "platform", "infra"],
    titulo: "DevOps Engineer Pleno",
    empresa: "Estudio Caju",
    local: "Remoto (Brasil)",
    salarioMin: 10000,
    salarioMax: 15000,
    descricao:
      "DevOps com AWS (EKS, ECS, RDS, Lambda), Terraform, Ansible, GitLab CI/CD ou GitHub Actions, Docker, Kubernetes, observabilidade (Datadog, Grafana, Prometheus) e Linux. Familiar com Python ou Go pra automacao.",
  },
  {
    id: "fix-sre-senior-1",
    areas: ["sre", "devops", "platform", "infra", "engenheiro"],
    titulo: "Site Reliability Engineer Senior",
    empresa: "Acme do Brasil",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 15000,
    salarioMax: 23000,
    descricao:
      "SRE senior com AWS/GCP, Kubernetes em escala, Terraform, Go ou Python, observabilidade, incident response, SLO/SLI, capacity planning e mentoria. Ingles fluente. Lideranca tecnica e cultura de blameless postmortem.",
  },
  {
    id: "fix-cloud-arch-senior-1",
    areas: ["cloud", "architect", "arquiteto", "devops", "platform", "infra", "senior"],
    titulo: "Cloud Architect Senior",
    empresa: "Tropical Logistica",
    local: "Brasilia, DF (Hibrido)",
    salarioMin: 18000,
    salarioMax: 28000,
    descricao:
      "Cloud architect senior pra desenhar arquitetura multi-cloud (AWS, GCP, Azure). Stack: Kubernetes, Terraform, Docker, Linux, Python ou Go, observabilidade (Datadog, Grafana, Prometheus), CI/CD (GitHub Actions), seguranca cloud (OWASP, IAM, KMS), Git e cultura DevSecOps. Lideranca tecnica, mentoria e parceria com squads. Ingles fluente.",
  },

  // === Seguranca ===
  {
    id: "fix-sec-pleno-1",
    areas: ["seguranca", "security", "infosec", "pentest", "appsec"],
    titulo: "Analista de Seguranca da Informacao Pleno",
    empresa: "Banco Andorinha",
    local: "Sao Paulo, SP",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Analista pleno em seguranca com experiencia em pentest, OWASP Top 10, threat modeling, SIEM, EDR, hardening Linux/Windows, AWS, Docker, Kubernetes e resposta a incidentes. Familiar com Python e SQL pra automacao e analytics. Git no dia a dia. Certificacoes (CEH, OSCP, Security+) sao diferenciais. Ingles intermediario.",
  },
  {
    id: "fix-sec-senior-1",
    areas: ["seguranca", "security", "infosec", "appsec", "engenheiro"],
    titulo: "Engenheiro(a) de Seguranca Senior",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 14000,
    salarioMax: 22000,
    descricao:
      "AppSec/Cloud Security senior com AWS, Kubernetes, OWASP Top 10, SAST/DAST, threat modeling, Python ou Go, Terraform e cultura DevSecOps. Lideranca em programas de seguranca, mentoria e ingles fluente.",
  },
  {
    id: "fix-sec-pentest-senior-1",
    areas: ["seguranca", "security", "pentest", "pentester", "red team", "senior"],
    titulo: "Pentester Senior - Red Team",
    empresa: "Cardume Fintech",
    local: "Remoto (Brasil)",
    salarioMin: 14000,
    salarioMax: 21000,
    descricao:
      "Pentester senior pra liderar exercicios de red team. Forte em OWASP Top 10, web app pentest, mobile pentest, cloud (AWS, Kubernetes), Python pra automacao, Burp Suite, Metasploit, Git, Docker e Linux. Certificacoes (OSCP, OSWE, CRTO) sao diferenciais. Mentoria de pentesters juniores, relatorios tecnicos e executivos, parceria com AppSec. Ingles fluente requisito.",
  },

  // === QA ===
  {
    id: "fix-qa-pleno-1",
    areas: ["qa", "quality", "tester", "automacao", "test"],
    titulo: "Analista de QA Automacao Pleno",
    empresa: "Cooperativa Verde",
    local: "Remoto (Brasil)",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "QA pleno com automacao em Cypress, Playwright ou Selenium, JavaScript/TypeScript, testes de API (Postman, REST), Git, CI/CD e metodologia agile (scrum/kanban). Familiar com Python e Docker.",
  },
  {
    id: "fix-qa-lead-1",
    areas: ["qa", "quality", "lead", "lideranca", "test", "automacao"],
    titulo: "QA Lead",
    empresa: "Cabecao Games",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 16000,
    salarioMax: 24000,
    descricao:
      "QA Lead pra estruturar estrategia de qualidade end-to-end. Stack: Cypress, Playwright, Selenium, JavaScript, TypeScript, Python, testes de API (REST, Postman), CI/CD (GitHub Actions), Docker, Git e cultura agile (scrum). Lideranca tecnica do squad de QA, gestao de pessoas (people management), mentoria, parceria com produto e engenharia. Ingles fluente.",
  },

  // === Mobile ===
  {
    id: "fix-mobile-pleno-1",
    areas: ["mobile", "android", "ios", "desenvolvedor", "dev"],
    titulo: "Desenvolvedor(a) Mobile Pleno",
    empresa: "Estudio Caju",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Mobile pleno com Kotlin (Android) ou Swift (iOS), Java, JavaScript, TypeScript, Git, REST APIs, GCP (Firebase), testes automatizados, CI/CD (Bitrise/GitHub Actions) e cultura agile (scrum). Experiencia com React Native ou Flutter e diferencial. Ingles intermediario.",
  },
  {
    id: "fix-mobile-ios-senior-1",
    areas: ["mobile", "ios", "swift", "desenvolvedor", "dev", "senior"],
    titulo: "Desenvolvedor(a) iOS Senior",
    empresa: "Bossa Studio",
    local: "Remoto (Brasil)",
    salarioMin: 14000,
    salarioMax: 20000,
    descricao:
      "iOS senior com Swift, SwiftUI, Combine, arquitetura MVVM/Clean, testes (XCTest), CI/CD (Bitrise, GitHub Actions), Git, REST APIs, GCP (Firebase) e analytics. Lideranca tecnica em squad mobile, mentoria, code review e parceria com produto e UX/UI. Familiar com Kotlin pra parceria com Android. Ingles fluente.",
  },
  {
    id: "fix-mobile-android-pleno-1",
    areas: ["mobile", "android", "kotlin", "desenvolvedor", "dev"],
    titulo: "Desenvolvedor(a) Android Pleno",
    empresa: "Carioca Midia",
    local: "Remoto (Brasil)",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Android pleno com Kotlin, Jetpack Compose, arquitetura MVVM/Clean, Java legado, Git, REST APIs, GCP (Firebase), testes automatizados, CI/CD (GitHub Actions) e cultura agile (scrum). Familiar com TypeScript ou JavaScript pra ferramentas internas. Ingles intermediario.",
  },

  // === Marketing / SEO / Growth ===
  {
    id: "fix-mkt-pleno-1",
    areas: ["marketing", "growth", "digital"],
    titulo: "Analista de Marketing Digital Pleno",
    empresa: "Acme do Brasil",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 6500,
    salarioMax: 10000,
    descricao:
      "Marketing digital com SEO, Google Ads, Meta Ads, growth, analytics (GA4, Looker Studio), CRM (HubSpot/Salesforce), Excel e storytelling. Familiar com SQL e copywriting. Ingles intermediario.",
  },
  {
    id: "fix-growth-senior-1",
    areas: ["growth", "marketing", "produto", "product"],
    titulo: "Growth Manager Senior",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 12000,
    salarioMax: 18000,
    descricao:
      "Senior em growth com experimentacao A/B, funil AARRR, SEO, analytics (SQL, Looker, GA4), product management e parceria com produto e dados. Marketing pago, retencao e ingles fluente.",
  },
  {
    id: "fix-mkt-perf-pleno-1",
    areas: ["marketing", "performance", "midia", "digital", "growth"],
    titulo: "Analista de Performance Pleno",
    empresa: "Jericoacoara Travel",
    local: "Remoto (Brasil)",
    salarioMin: 6500,
    salarioMax: 10500,
    descricao:
      "Performance marketing pleno com Google Ads, Meta Ads, TikTok Ads, SEO tecnico, analytics (GA4, Looker Studio), Excel avancado, SQL basico, CRM (HubSpot) e cultura de growth. Familiar com storytelling, copywriting e parceria com produto (product management). Cultura agile (scrum). Ingles intermediario.",
  },

  // === Vendas / CS ===
  {
    id: "fix-vendas-pleno-1",
    areas: ["vendas", "sales", "comercial", "account", "executivo"],
    titulo: "Executivo(a) de Vendas SaaS Pleno",
    empresa: "Cooperativa Verde",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 7000,
    salarioMax: 12000,
    descricao:
      "Vendas B2B SaaS com prospeccao, qualificacao, demos, fechamento, CRM (Salesforce/HubSpot) e analytics (Excel, SQL basico). Familiar com metodologias SPIN/MEDDIC. Ingles intermediario e diferencial.",
  },
  {
    id: "fix-cs-pleno-1",
    areas: ["customer success", "cs", "sucesso do cliente", "account manager"],
    titulo: "Customer Success Manager Pleno",
    empresa: "Acme do Brasil",
    local: "Remoto (Brasil)",
    salarioMin: 7500,
    salarioMax: 12000,
    descricao:
      "CS pleno com gestao de carteira B2B, onboarding, expansion, churn reduction, CRM (Salesforce, HubSpot), analytics (Excel, SQL basico) e parceria com vendas e produto. Ingles avancado.",
  },
  {
    id: "fix-sales-eng-pleno-1",
    areas: ["sales", "vendas", "engineer", "engenheiro", "pre-vendas", "presales"],
    titulo: "Sales Engineer Pleno",
    empresa: "Hummingbird Tech",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Sales engineer (pre-vendas tecnico) com SaaS B2B. Stack tecnica: SQL, Python ou JavaScript basico, REST APIs, AWS basico, Docker basico e Git. Negocios: CRM (Salesforce, HubSpot), POCs, demos tecnicas, RFP/RFI, metodologias SPIN/MEDDIC, storytelling com dados (Looker) e parceria com produto e engenharia. Ingles fluente requisito.",
  },

  // === Financas ===
  {
    id: "fix-fin-pleno-1",
    areas: ["financas", "finance", "financeiro", "fp&a", "controladoria"],
    titulo: "Analista Financeiro FP&A Pleno",
    empresa: "Banco Andorinha",
    local: "Sao Paulo, SP",
    salarioMin: 7500,
    salarioMax: 12000,
    descricao:
      "FP&A pleno com Excel avancado, Power BI, SQL, modelagem financeira, budgeting, forecasting e parceria com lideranca. Familiar com Python e dbt e diferencial. Ingles intermediario.",
  },
  {
    id: "fix-fin-controller-senior-1",
    areas: ["financas", "finance", "controller", "controladoria", "senior"],
    titulo: "Controller Senior",
    empresa: "Pampa Agro",
    local: "Porto Alegre, RS (Presencial)",
    salarioMin: 14000,
    salarioMax: 20000,
    descricao:
      "Controller senior pra liderar controladoria. Forte em modelagem financeira, contabilidade, fiscal, budgeting, forecasting, fechamento mensal, IFRS, ERP (SAP/TOTVS), Excel avancado, Power BI, SQL e analytics. Gestao de pessoas (people management/lideranca de time), mentoria, parceria com auditoria e CFO. Ingles avancado.",
  },

  // === RH ===
  {
    id: "fix-hr-pleno-1",
    areas: ["rh", "hr", "people", "recursos humanos", "talent", "recrutamento"],
    titulo: "Analista de People Analytics Pleno",
    empresa: "Norte Tecnologia",
    local: "Remoto (Brasil)",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "People analytics pleno com SQL, Excel avancado, Power BI/Looker, analytics e storytelling. Experiencia em engajamento, turnover, gestao de pessoas (people management) e lideranca em projetos de RH. Ingles intermediario.",
  },
  {
    id: "fix-hr-techrecruiter-pleno-1",
    areas: ["rh", "hr", "recrutamento", "recruiter", "tech recruiter", "talent"],
    titulo: "Tech Recruiter Pleno",
    empresa: "Quero Aprender",
    local: "Remoto (Brasil)",
    salarioMin: 6500,
    salarioMax: 10500,
    descricao:
      "Tech recruiter pleno pra recrutar engenheiros, data scientists e product managers. Forte em hunting (LinkedIn, GitHub), entrevistas tecnicas de fit, CRM de candidatos (Gupy, Greenhouse), Excel, SQL basico, analytics (Looker basico), employer branding e parceria com lideranca tecnica. Gestao de pessoas (people management) em projetos. Ingles fluente requisito.",
  },

  // === Tech Leadership / Eng Mgmt ===
  {
    id: "fix-tl-senior-1",
    areas: ["tech lead", "lideranca", "engineer", "engenheiro", "lead"],
    titulo: "Tech Lead Backend Senior",
    empresa: "Estudio Caju",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 18000,
    salarioMax: 28000,
    descricao:
      "Tech lead senior com Node.js ou Go, TypeScript, AWS, Kubernetes, Docker, PostgreSQL, microsservicos e arquitetura. Lideranca tecnica, mentoria, gestao de pessoas (people management), agile e ingles fluente. Cultura de excelencia tecnica.",
  },
  {
    id: "fix-eng-mgr-1",
    areas: ["engineering manager", "eng manager", "lideranca", "gestao", "engenheiro", "lead"],
    titulo: "Engineering Manager",
    empresa: "Hummingbird Tech",
    local: "Remoto (Brasil)",
    salarioMin: 25000,
    salarioMax: 38000,
    descricao:
      "Engineering manager pra liderar 2 squads (8-12 devs). Background tecnico forte em Node.js, TypeScript, AWS, Kubernetes, Docker e Git. Foco em gestao de pessoas (people management/lideranca), 1:1s, plano de carreira, hiring, performance, parceria com produto (product manager, product management), agile (scrum) e cultura. Ingles fluente requisito.",
  },

  // === Consultoria / Estrategia (NOVO) ===
  {
    id: "fix-consultor-senior-1",
    areas: ["consultoria", "consultor", "consulting", "estrategia", "strategy", "senior"],
    titulo: "Consultor(a) Senior de Estrategia",
    empresa: "Mundo Plural Educacao",
    local: "Sao Paulo, SP (Hibrido)",
    salarioMin: 15000,
    salarioMax: 23000,
    descricao:
      "Consultor(a) senior pra liderar projetos de transformacao digital e estrategia. Forte em frameworks de estrategia, modelagem financeira, Excel avancado, Power BI, SQL, analytics, storytelling com dados e apresentacao executiva. Gestao de pessoas (people management/lideranca de times de projeto), mentoria de consultores juniores e parceria com C-level. Ingles fluente requisito.",
  },
  {
    id: "fix-estrategia-pleno-1",
    areas: ["estrategia", "strategy", "analista", "consultoria", "consultor", "negocios"],
    titulo: "Analista Estrategico Pleno",
    empresa: "Cerrado Verde",
    local: "Brasilia, DF (Hibrido)",
    salarioMin: 8000,
    salarioMax: 13000,
    descricao:
      "Analista de estrategia pleno em projetos de planejamento estrategico, OKRs e transformacao. Forte em modelagem financeira, Excel avancado, Power BI, SQL, analytics, storytelling com dados, apresentacoes executivas e parceria com lideranca. Familiar com Python pra automacao e Looker. Cultura agile (scrum/kanban). Ingles avancado.",
  },

  // === Operacoes / Logistica (NOVO) ===
  {
    id: "fix-sop-pleno-1",
    areas: ["operacoes", "logistica", "supply chain", "s&op", "planejamento", "analista"],
    titulo: "Analista de S&OP Pleno",
    empresa: "Tropical Logistica",
    local: "Campinas, SP (Hibrido)",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "Analista de S&OP (Sales & Operations Planning) pleno. Forte em planejamento de demanda, forecasting, modelagem em Excel avancado, SQL, Power BI, analytics, ERP (SAP/TOTVS) e storytelling com dados. Familiar com Python pra automacao e dbt. Parceria com supply chain, comercial (vendas) e financas. Cultura agile (scrum/kanban). Ingles intermediario.",
  },
  {
    id: "fix-ops-mgr-senior-1",
    areas: ["operacoes", "operations", "gerente", "manager", "logistica", "senior", "lideranca"],
    titulo: "Gerente de Operacoes",
    empresa: "Pampa Agro",
    local: "Salvador, BA (Presencial)",
    salarioMin: 16000,
    salarioMax: 24000,
    descricao:
      "Gerente de operacoes senior pra liderar centro de distribuicao. Forte em gestao de pessoas (people management/lideranca de equipes operacionais 30+), supply chain, KPIs de produtividade, lean, six sigma, Excel avancado, Power BI, SQL, ERP (SAP), analytics e storytelling com dados. Parceria com financas, comercial e qualidade. Ingles intermediario.",
  },

  // === Educacao / T&D (NOVO) ===
  {
    id: "fix-learning-pleno-1",
    areas: ["educacao", "learning", "treinamento", "t&d", "people", "rh"],
    titulo: "Especialista em Learning & Development Pleno",
    empresa: "Quero Aprender",
    local: "Remoto (Brasil)",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "Especialista em learning & development pra estruturar trilhas de capacitacao tecnica e comportamental. Forte em design instrucional, LMS (Moodle, Canvas), analytics (Excel, Power BI, SQL basico), storytelling, gestao de projetos, agile (scrum) e parceria com lideranca e RH (people management leve). Familiar com Looker e Python pra dashboards. Ingles avancado.",
  },
  {
    id: "fix-instr-design-pleno-1",
    areas: ["educacao", "design instrucional", "instrutor", "learning", "treinamento", "designer"],
    titulo: "Designer Instrucional Pleno",
    empresa: "Mundo Plural Educacao",
    local: "Remoto (Brasil)",
    salarioMin: 6500,
    salarioMax: 10500,
    descricao:
      "Designer instrucional pleno pra criacao de cursos online corporativos. Forte em design instrucional, storytelling, prototipagem (Figma), UX para educacao (user experience), LMS (Moodle), video, podcasts, Excel, analytics basico e parceria com especialistas tecnicos. Familiar com HTML/CSS, Git basico e cultura agile (scrum/kanban). Ingles avancado.",
  },

  // === Conteudo / Criacao (NOVO) ===
  {
    id: "fix-content-pleno-1",
    areas: ["conteudo", "content", "marketing", "redator", "estrategista", "midia"],
    titulo: "Content Strategist Pleno",
    empresa: "Carioca Midia",
    local: "Rio de Janeiro, RJ (Hibrido)",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "Content strategist pleno pra liderar estrategia editorial multi-canal. Forte em SEO, copywriting, storytelling, marketing de conteudo, analytics (GA4, Looker Studio), CRM (HubSpot), Excel, gestao de calendario editorial e parceria com growth e produto (product management). Familiar com SQL basico, Figma e cultura agile (scrum). Ingles fluente.",
  },
  {
    id: "fix-redator-tech-pleno-1",
    areas: ["conteudo", "redator", "writer", "tech writer", "documentacao", "marketing"],
    titulo: "Redator Tecnico Pleno",
    empresa: "Hummingbird Tech",
    local: "Remoto (Brasil)",
    salarioMin: 6500,
    salarioMax: 10000,
    descricao:
      "Redator(a) tecnico pleno pra documentacao de APIs e produto. Forte em escrita tecnica em portugues e ingles, REST APIs, Markdown, Git/GitHub, SEO basico, storytelling, parceria com engenharia e produto (product manager/product management). Familiar com SQL basico, JavaScript leitura, Python leitura e cultura agile (scrum). Ingles fluente requisito.",
  },

  // === Compliance / Juridico (NOVO) ===
  {
    id: "fix-compliance-pleno-1",
    areas: ["compliance", "juridico", "legal", "regulatorio", "governanca", "lgpd"],
    titulo: "Compliance Officer Pleno",
    empresa: "Banco Andorinha",
    local: "Sao Paulo, SP",
    salarioMin: 9000,
    salarioMax: 14000,
    descricao:
      "Compliance officer pleno em instituicao financeira. Forte em LGPD, BACEN, AML/PLD, OWASP basico de seguranca, governanca, gestao de riscos, auditoria, politicas, Excel avancado, SQL basico, Power BI, analytics, storytelling e parceria com seguranca (security/infosec) e juridico. Cultura agile (scrum/kanban). Ingles fluente.",
  },

  // === ESG / Sustentabilidade (NOVO) ===
  {
    id: "fix-esg-pleno-1",
    areas: ["esg", "sustentabilidade", "sustainability", "analista", "ambiental", "governanca"],
    titulo: "Analista de ESG Pleno",
    empresa: "Manaca Bio",
    local: "Florianopolis, SC (Hibrido)",
    salarioMin: 7000,
    salarioMax: 11000,
    descricao:
      "Analista de ESG pleno pra estruturar relatorios de sustentabilidade (GRI, SASB, TCFD). Forte em metricas ambientais, sociais e de governanca, modelagem em Excel avancado, Power BI, SQL basico, analytics, storytelling com dados e parceria com financas, juridico e operacoes. Familiar com Python basico e Looker. Cultura agile (scrum). Ingles fluente.",
  },
];

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function toJob(c) {
  const sal =
    c.salarioMin && c.salarioMax
      ? `R$ ${c.salarioMin.toLocaleString("pt-BR")} - R$ ${c.salarioMax.toLocaleString("pt-BR")}`
      : null;
  return {
    id: c.id,
    source: "fixtures",
    titulo: c.titulo,
    empresa: c.empresa,
    local: c.local,
    url: null,
    descricao: c.descricao,
    salario: sal,
    postedAt: null,
  };
}

// Determinismo: ordena por id pra que `searchFixtures` sempre retorne a
// mesma sequencia (tests dependem disso).
function deterministicSort(a, b) {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export async function searchFixtures({ role, limit = 3 }) {
  const target = normalize(role || "");
  if (!target) {
    return [...CATALOG].sort(deterministicSort).slice(0, limit).map(toJob);
  }

  // Score: bate `target` contra `areas` + tokens do `titulo` de cada fixture.
  // areaHit pesa mais (10) que titHit (5) pq areas e curadoria explicita.
  // Fix P0.7 (report Data 2026-06-30 §Apendice C): filtra NOISE_TOKENS antes
  // do titHit. Antes, "pleno"/"senior"/"manager" no targetRole batiam ~25 de
  // 47 fixtures de verticais aleatorias ("Analista Pleno", "Designer Pleno",
  // "Backend Pleno" todos compartilham o token "pleno"), poluindo o pool. O
  // filtro >=3 chars sozinho nao cobre — senioridades tem 5+ chars. Reuso
  // do mesmo NOISE_TOKENS usado em `relaxRole` (lib/jobs/index.js) garante
  // consistencia entre o que e strippado pra providers reais e o que e
  // strippado pro matcher de fixtures.
  const targetTokens = target
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !NOISE_TOKENS.has(t));
  const scored = CATALOG.map((c) => {
    const tit = normalize(c.titulo);
    const areaHit = c.areas.some(
      (a) => target.includes(a) || (a.length >= 3 && target.split(/\s+/).some((tok) => tok === a)) || (a.length >= 4 && a.includes(target))
    );
    const titHit = targetTokens.some((tok) => tit.includes(tok));
    let s = 0;
    if (areaHit) s += 10;
    if (titHit) s += 5;
    return { c, s };
  });

  const matched = scored
    .filter((x) => x.s > 0)
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      return deterministicSort(a.c, b.c);
    });

  // Decisao 2026-06-30 (Gimli G3 §5 R6): honestidade > preencher.
  // Antes: role nicho nao-mapeado retornava `catalog.slice(0, 8)` —
  // farmaceutico/professor recebia 8 vagas de Backend Engineer (1os por
  // ordem alfabetica de id: fix-ai-eng-*, fix-be-go-*, fix-be-java-*).
  // Agora: retorna [] e deixa o caller (lib/jobs/index.js) emitir o flag
  // `noRelevantFixtures: true` pra UI mostrar empty-state honesto + form
  // "pedir cobertura". Cf. tests/unit/jobs.test.js "role nicho retorna []".
  if (matched.length === 0) {
    return [];
  }
  return matched.slice(0, limit).map((x) => toJob(x.c));
}
