declare module "@fastify/static" {
  import { FastifyPluginCallback } from "fastify";
  const plugin: FastifyPluginCallback<any>;
  export default plugin;
}
