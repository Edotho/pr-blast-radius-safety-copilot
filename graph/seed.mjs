import neo4j from 'neo4j-driver';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and configure it.`);
  return value;
}

const driver = neo4j.driver(
  required('NEO4J_URI'),
  neo4j.auth.basic(required('NEO4J_USERNAME'), required('NEO4J_PASSWORD'))
);
const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
try {
  const repo = 'hacksprint-t1-demo';
  await session.run('MATCH (n:DemoModule {repo: $repo}) DETACH DELETE n', { repo });
  await session.run(`
    CREATE (p:DemoModule {repo: '${repo}', path: 'src/permissions.js'}),
           (a:DemoModule {repo: '${repo}', path: 'src/approval.js'}),
           (r:DemoModule {repo: '${repo}', path: 'src/release.js'}),
           (a)-[:DEPENDS_ON]->(p),
           (r)-[:DEPENDS_ON]->(a)
  `);
  console.log('Seeded hacksprint-t1-demo graph: permissions <- approval <- release.');
} finally {
  await session.close();
  await driver.close();
}
