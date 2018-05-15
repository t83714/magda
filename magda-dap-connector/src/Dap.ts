import AsyncPage from "@magda/typescript-common/dist/AsyncPage";
import DapUrlBuilder from "./DapUrlBuilder";
import formatServiceError from "@magda/typescript-common/dist/formatServiceError";
import { ConnectorSource } from "@magda/typescript-common/dist/JsonConnector";
import retry from "@magda/typescript-common/dist/retry";
import * as request from "request";
import * as URI from "urijs";

export interface DapThing {
    id: string;
    name: string;
    [propName: string]: any;
}

export interface DapResource extends DapThing {}

export interface DapDataset extends DapThing {
    resources: DapResource[];
}

export interface DapOrganization extends DapThing {}

export interface DapPackageSearchResponse {
    result: DapPackageSearchResult;
    [propName: string]: any;
}

export interface DapPackageSearchResult {
    count: number;
    results: DapDataset[];
    [propName: string]: any;
}
export interface DapDistribution{
    distributions: object[]
}

export interface DapOrganizationListResponse {
    result: DapOrganization[];
    [propName: string]: any;
}

export interface DapOptions {
    baseUrl: string;
    id: string;
    name: string;
    apiBaseUrl?: string;
    pageSize?: number;
    maxRetries?: number;
    secondsBetweenRetries?: number;
    ignoreHarvestSources?: string[];
}

export default class Dap implements ConnectorSource {
    public readonly id: string;
    public readonly name: string;
    public readonly pageSize: number;
    public readonly maxRetries: number;
    public readonly secondsBetweenRetries: number;
    public readonly urlBuilder: DapUrlBuilder;
    private ignoreHarvestSources: string[];
    readonly hasFirstClassOrganizations: boolean = true;
    constructor({
        baseUrl,
        id,
        name,
        apiBaseUrl,
        pageSize = 1000,
        maxRetries = 10,
        secondsBetweenRetries = 10,
        ignoreHarvestSources = []
    }: DapOptions) {
        this.id = id;
        this.name = name;
        this.pageSize = pageSize;
        this.maxRetries = maxRetries;
        this.secondsBetweenRetries = secondsBetweenRetries;
        this.ignoreHarvestSources = ignoreHarvestSources;
        this.urlBuilder = new DapUrlBuilder({
            id: id,
            name: name,
            baseUrl,
            apiBaseUrl
        });
    }

     public getJsonDatasets(): AsyncPage<any[]> {
        const packagePages = this.packageSearch({
            ignoreHarvestSources: this.ignoreHarvestSources,
        });
        return packagePages.map(packagePage => {
            if(packagePage){
                // return packagePage.dataCollections
                return packagePage.detailDataCollections
            }
        })
    }

    public getJsonDataset(id: string): Promise<any> {
        const url = this.urlBuilder.getPackageShowUrl(id);
        return new Promise<any>((resolve, reject) => {
            request(url, { json: true }, (error, response, body) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(body);
            });
        });
    }
    public getJsonDistributions(dataset: any): AsyncPage<DapDistribution[]> {
        // dataset of dataCollection from DAP /collections api does not contain a 'data' field, which defines the dirstributions 
        // Herr use an api call (/collections/id) to get the dataset with the field 'data', and then fetch
        if(dataset.data){
            return AsyncPage.singlePromise<DapDistribution[]>(this.requestDistributions(dataset.data))
        }
        return AsyncPage.single<DapDistribution[]>( []);
    }

    public packageSearch(options?: {
        ignoreHarvestSources?: string[];
        q?: string;
        p?: number;
        soud?: string;
        sb?: string;
        rpp?: number;
    }): AsyncPage<DapPackageSearchResponse> {
        const url = new URI(this.urlBuilder.getPackageSearchUrl());

        const solrQueries = [];

        if (
            options &&
            options.ignoreHarvestSources &&
            options.ignoreHarvestSources.length > 0
        ) {
            solrQueries.push(
                ...options.ignoreHarvestSources.map(title => {
                    const encoded =
                        title === "*"
                            ? title
                            : encodeURIComponent('"' + title + '"');
                    return `-harvest_source_title:${encoded}`;
                })
            );
        }

        let fqComponent = "";
        if (solrQueries.length > 0) {
            fqComponent = "&q=" + solrQueries.join("+");
        }

        if (options && options.sb) {
            url.addSearch("sb", options.sb);
        }
        if (options && options.soud) {
            url.addSearch("soud", options.soud);
        }

        const startStart = options.p || 1;
        let startIndex = startStart;

        return AsyncPage.create<DapPackageSearchResponse>(previous => {
            if (previous ) {
                if (startIndex*previous.resultsPerPage >= previous.totalResults) {
                    return undefined;
                }else{
                    startIndex = startIndex + 1;
                }
            }
            const remaining = options.rpp
                ? startIndex*options.rpp - previous.totalResults
                : undefined;
            return this.requestPackageSearchPage(
                url,
                fqComponent,
                startIndex,
                remaining
            );
        });
    }
    
    searchDatasetsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        return AsyncPage.single([]);
    }

    public getJsonFirstClassOrganizations(): AsyncPage<any[]> {
        return AsyncPage.single([
            {
                name: 'CSIRO',
                identifier: 'CSIRO',
                title: 'CSIRO (Australia)',
                description: `The Commonwealth Scientific and Industrial Research Organisation (CSIRO) is Australia's national science agency and one of the largest and most diverse research agencies in the world. The CSIRO Data Access Portal provides access to research data, software and other digital assets published by CSIRO across a range of disciplines. The portal is maintained by CSIRO Information Management & Technology to facilitate sharing and reuse.`,
                imageUrl: 'https://data.csiro.au/dap/resources-2.6.6/images/csiro_logo.png'
            }
        ]);
    }

    getJsonFirstClassOrganization(id: string): Promise<any> {
        return Promise.resolve(
            {
                name: 'CSIRO',
                identifier: 'CSIRO',
                title: 'CSIRO (Australia)',
                description: `The Commonwealth Scientific and Industrial Research Organisation (CSIRO) is Australia's national science agency and one of the largest and most diverse research agencies in the world. The CSIRO Data Access Portal provides access to research data, software and other digital assets published by CSIRO across a range of disciplines. The portal is maintained by CSIRO Information Management & Technology to facilitate sharing and reuse.`,
                imageUrl: 'https://data.csiro.au/dap/resources-2.6.6/images/csiro_logo.png'
            }
        )
    }

    searchFirstClassOrganizationsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        return AsyncPage.single([]);
    }
   
    public getJsonDatasetPublisherId(dataset: any): string {
        return 'CSIRO'
    }
    getJsonDatasetPublisher(dataset: any): Promise<any> {
        return Promise.resolve(
            {
                name: 'CSIRO',
                identifier: 'CSIRO',
                title: 'CSIRO (Australia)',
                description: `The Commonwealth Scientific and Industrial Research Organisation (CSIRO) is Australia's national science agency and one of the largest and most diverse research agencies in the world. The CSIRO Data Access Portal provides access to research data, software and other digital assets published by CSIRO across a range of disciplines. The portal is maintained by CSIRO Information Management & Technology to facilitate sharing and reuse.`,
                imageUrl: 'https://data.csiro.au/dap/resources-2.6.6/images/csiro_logo.png'
            }
        )
    }

    private requestPackageSearchPage(
        url: uri.URI,
        fqComponent: string,
        startIndex: number,
        maxResults: number
    ): Promise<DapPackageSearchResponse> {
        const pageSize =
            maxResults && maxResults < this.pageSize
                ? maxResults
                : this.pageSize;

        const pageUrl = url.clone();
        pageUrl.addSearch("p", startIndex);
        pageUrl.addSearch("rpp", pageSize);

        const operation = () =>
            new Promise<DapPackageSearchResponse>((resolve, reject) => {
                const requestUrl = pageUrl.toString() + fqComponent;
                // console.log("Requesting " + requestUrl);
                request(requestUrl, { json: true }, async (error, response, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    console.log("Received@" + startIndex);
                    await Promise.all(body.dataCollections.map((simpleData:any) =>{
                        const url = this.urlBuilder.getPackageShowUrl(simpleData.id.identifier); 
                        return new Promise<any>((resolve2, reject2) => {
                            request(url, { json: true }, (error, response, detail) => {
                                if (error) {
                                    reject2(error);
                                    return;
                                }
                                resolve2(detail);
                            });
                        });
                    })).then((values) => {
                        body['detailDataCollections'] = values
                    }).catch(error => console.log(error))
                    await resolve(body)
                })
            })
        
        return retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to GET ${pageUrl.toString()}.`,
                        e,
                        retriesLeft
                    )
                )
        );
    }

    private requestDistributions(
        url: string,
    ): Promise<DapDistribution[]> {
        const pageUrl = url
        const operation =  () =>
            new  Promise<DapDistribution[]>( async (resolve, reject) => {
                const requestUrl = pageUrl
                request(requestUrl, { json: true }, (error, response, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    let distributionArray:any = []
                    for(let index in body.file){
                        let fileObj = body.file[index]
                        fileObj['licence'] = body.licence
                        fileObj['rights'] = body.rights
                        fileObj['access'] = body.access
                        fileObj['self'] = body.self
                        distributionArray.push(fileObj)
                    }
                
                    resolve(distributionArray);
                });
            });

        return  retry(
            operation,
            this.secondsBetweenRetries,
            this.maxRetries,
            (e, retriesLeft) =>
                console.log(
                    formatServiceError(
                        `Failed to GET ${pageUrl.toString()}.`,
                        e,
                        retriesLeft
                    )
                )
        );
    }


}
