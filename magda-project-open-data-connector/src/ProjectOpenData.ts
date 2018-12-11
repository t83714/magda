import AsyncPage from "@magda/typescript-common/dist/AsyncPage";
import formatServiceError from "@magda/typescript-common/dist/formatServiceError";
import { ConnectorSource } from "@magda/typescript-common/dist/JsonConnector";
import retry from "@magda/typescript-common/dist/retry";
import request from "@magda/typescript-common/dist/request";

export default class ProjectOpenData implements ConnectorSource {
    public readonly id: string;
    public readonly name: string;

    private url: string;
    private secondsBetweenRetries: number;
    private maxRetries: number;
    private dataPromise: Promise<object>;

    constructor(options: ProjectOpenDataOptions) {
        this.id = options.id;
        this.name = options.name;
        this.url = options.url;
        this.secondsBetweenRetries = options.secondsBetweenRetries || 10;
        this.maxRetries = options.maxRetries || 10;

        const operation = () =>
            new Promise<object>((resolve, reject) => {
                request(this.url, { json: true }, (error, response, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(body);
                });
            });

        this.dataPromise = retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to GET ${this.url}.`,
                        e,
                        retriesLeft
                    )
                )
        );
    }

    public getJsonDatasets(): AsyncPage<any[]> {
        return AsyncPage.singlePromise<object[]>(
            this.dataPromise.then((response: any) => response.dataset)
        );
    }

    public getJsonDataset(id: string): Promise<any> {
        return this.dataPromise.then((response: any) => {
            if (!response || !response.dataset) {
                return undefined;
            }

            return response.dataset.filter(
                (dataset: any) => dataset.identifier === id
            )[0];
        });
    }

    public searchDatasetsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        const promise = this.dataPromise.then((response: any) => {
            if (!response || !response.dataset) {
                return undefined;
            }

            const lowercaseTitle = title.toLowerCase();
            return response.dataset
                .filter(
                    (dataset: any) =>
                        dataset.title.toLowerCase().indexOf(lowercaseTitle) >= 0
                )
                .slice(0, maxResults);
        });

        return AsyncPage.singlePromise<any[]>(promise);
    }

    public getJsonDistributions(dataset: any): AsyncPage<any[]> {
        return AsyncPage.single<object[]>(dataset.distribution || []);
    }

    // TODO: we could make this source have first-class organizations pretty easily.
    // something like this:
    // protected getJsonFirstClassOrganizations(): AsyncPage<any[]> {
    //     return AsyncPage.singlePromise<object[]>(this.dataPromise.then((response: any) => {
    //         const orgs = new Set<string>();
    //         const datasets: any = response.dataset;
    //         datasets.forEach((dataset: any) => {
    //             if (dataset.publisher && dataset.publisher.name) {
    //                 orgs.add(dataset.publisher.name);
    //             }
    //         });
    //         return [...orgs].map(name => ({name: name}));
    //     }));
    // }

    public readonly hasFirstClassOrganizations: boolean = false;

    public getJsonFirstClassOrganizations(): AsyncPage<any[]> {
        return undefined;
    }

    public getJsonFirstClassOrganization(id: string): Promise<any> {
        return undefined;
    }

    public searchFirstClassOrganizationsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        return undefined;
    }

    public getJsonDatasetPublisherId(dataset: any): any {
        if (!dataset.publisher) {
            return undefined;
        }
        return dataset.publisher.name;
    }

    public getJsonDatasetPublisher(dataset: any): Promise<any> {
        const publisher = {
            ...dataset.publisher,
            contactPoint: dataset.contactPoint
        };
        return publisher;
    }
}

export interface ProjectOpenDataOptions {
    id: string;
    name: string;
    url: string;
    secondsBetweenRetries?: number;
    maxRetries?: number;
}
