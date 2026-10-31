// Directed consumer -> dependency edges. The blast-radius query walks inbound paths.
MERGE (p:DemoModule {repo: 'hacksprint-t1-demo', path: 'src/permissions.js'})
MERGE (a:DemoModule {repo: 'hacksprint-t1-demo', path: 'src/approval.js'})
MERGE (r:DemoModule {repo: 'hacksprint-t1-demo', path: 'src/release.js'})
MERGE (a)-[:DEPENDS_ON]->(p)
MERGE (r)-[:DEPENDS_ON]->(a)
