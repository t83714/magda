import { MockExpressServer } from "@magda/typescript-common/dist/test/connectors/MockExpressServer";

export class MockCSWCatalog extends MockExpressServer {
    spec: any;

    constructor(spec: any) {
        super();
        this.spec = spec;
    }

    runImplementation(registry: any) {
        registry.all("*", (req: any, res: any) => {
            res.set("Content-Type", "text/xml").send(this.spec);
        });
    }
}
