const {test}=require('node:test');const assert=require('node:assert/strict');const {createRequire}=require('node:module');const {join}=require('node:path');
test('patched CLI Zod parses Expo dev-tool schemas and creates strict command schema',()=>{
 const expoRequire=createRequire(require.resolve('expo/package.json'));
 const cli=expoRequire.resolve('@expo/cli/package.json');const cliRequire=createRequire(cli);
 const {PluginSchema,DevToolsPluginOutputSchema}=require(join(cli,'..','build/src/start/server/DevToolsPlugin.schema.js'));
 const {createMCPDevToolsExtensionSchema}=require(join(cli,'..','build/src/start/server/createMCPDevToolsExtensionSchema.js'));
 const plugin=PluginSchema.parse({packageName:'synthetic',packageRoot:'/synthetic',cliExtensions:{description:'Test',entryPoint:'index.js',commands:[{name:'inspect',title:'Inspect',environments:['cli','mcp'],parameters:[{name:'count',type:'number'}]}]}});
 const schema=createMCPDevToolsExtensionSchema(plugin);assert.deepEqual(schema.parse({command:'inspect',count:2}),{command:'inspect',count:2});assert.equal(schema.safeParse({command:'other'}).success,false);assert.equal(schema.safeParse({command:'inspect',unexpected:true}).success,false);assert.equal(schema.safeParse({command:'inspect',count:'2'}).success,false);
 assert.equal(DevToolsPluginOutputSchema.safeParse([{type:'text',text:'safe',level:'info'}]).success,true);assert.equal(DevToolsPluginOutputSchema.safeParse([{type:'image',url:'invalid'}]).success,false);
 const zod=cliRequire('zod');assert.equal(zod.toJSONSchema(schema).additionalProperties,false);
});
