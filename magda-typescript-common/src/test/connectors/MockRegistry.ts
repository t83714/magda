import { MockExpressServer } from "./MockExpressServer";

const body = require("body-parser");
const Ajv = require("ajv");
const ajv: any = new Ajv();

ajv.addFormat("date-time", /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}Z)?$/);

export class MockRegistry extends MockExpressServer {
    aspects: any = {};
    records: any = {};

    runImplementation(registry: any) {
        registry.use(
            body.json({
                limit: "500000kb"
            })
        );

        // registry.use((req: any, res: any, next: any) => {
        //     console.log(req.method, req.path, req.body);
        //     next();
        // });

        registry.put("/aspects/:id", (req: any, res: any) => {
            this.aspects[req.params.id] = req.body;
            res.json(req.body);
        });

        registry.put("/records/:id", (req: any, res: any) => {
            this.records[req.params.id] = req.body;
            // validate aspects
            if (req.body.aspects) {
                for (const [aspect, aspectBody] of Object.entries(
                    req.body.aspects
                )) {
                    try {
                        const schema = this.aspects[aspect].jsonSchema;
                        let valid = ajv.validate(schema, aspectBody);
                        if (!valid) {
                            const invalid = ajv.errors;
                            return res
                                .status(500)
                                .json({
                                    aspect,
                                    aspectBody,
                                    schema,
                                    invalid
                                })
                                .end();
                        }
                    } catch (e) {
                        console.log(e.message);
                    }
                }
            }
            res.json(req.body);
        });

        registry.put("/records/:id/aspects/:aspect", (req: any, res: any) => {
            const { id, aspect } = req.params;
            const aspectBody = req.body;
            this.records[id] = this.records[req.params.id] || {
                id,
                aspects: {}
            };
            this.records[id].aspects[aspect] = aspectBody;

            // validate aspect
            try {
                const schema = this.aspects[aspect].jsonSchema;
                let valid = ajv.validate(schema, aspectBody);
                if (!valid) {
                    const invalid = ajv.errors;
                    return res
                        .status(500)
                        .json({
                            aspect,
                            aspectBody,
                            schema,
                            invalid
                        })
                        .end();
                }
            } catch (e) {
                console.log(e.message);
            }

            res.json(req.body);
        });

        registry.delete("/records", (req: any, res: any) => {
            let count = 0;
            for (const [recordId, record] of Object.entries(this.records)) {
                if (record.sourceTag === req.query.sourceTagToPreserve) {
                    continue;
                }
                if (record.aspects.source.id === req.query.sourceId) {
                    delete this.records[recordId];
                    count++;
                }
            }
            res.json({ count });
        });

        registry.get("/records/*", (req: any, res: any) => {
            const id = decodeURI(req.path.substr(9));
            res.json(this.records[id]).end();
        });

        registry.get("/records", (req: any, res: any) => {
            res.json(this.records).end();
        });

        registry.all("*", function(req: any, res: any) {
            console.log("REG", req.method, req.path, req.body, req.query);
            res.status(200);
        });
    }
}

if (require.main === module) {
    const app = new MockRegistry();
    app.run(8080);
}
