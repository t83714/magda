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
    readonly hasFirstClassOrganizations: boolean = false;
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
        console.log('getJsonDatasets()')
        const packagePages = this.packageSearch({
            ignoreHarvestSources: this.ignoreHarvestSources,
        });
        return packagePages.map(packagePage => { 
            console.log('packagePage:', packagePage)
            return packagePage.dataCollection});
    }

    public getJsonDataset(id: string): Promise<any> {

        const url = this.urlBuilder.getPackageShowUrl(id);
        console.log('getJsonDataset()')
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
    public getJsonDistributions(dataset: any): AsyncPage<object[]> {
        console.log('getJsonDistributions()', dataset)
        if(dataset.data){
            this.requestDistributions(dataset.data).then(res =>{
                return res.json()
            }).then(json =>{
                let distributionArray:any = []
                for(let index in json.file){
                    let fileObj = json.file[index]
                    fileObj['licence'] = json.file[index].licence
                    fileObj['rights'] = json.file[index].rights
                    fileObj['access'] = json.file[index].access
                    fileObj['self'] = json.file[index].self
                    distributionArray.push(fileObj)
                }
                return AsyncPage.single<object[]>(distributionArray || []);
            }).catch(error => console.log(error))
        }
        
        return AsyncPage.single<object[]>( []);
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

        const startStart = options.p || 2;
        let startIndex = startStart;

        return AsyncPage.create<DapPackageSearchResponse>(previous => {
            console.log('asyncpage', url, startIndex)
            if (previous) {
                startIndex += previous.dataCollection.length;
                if (
                    startIndex >= previous.totalResults ||
                    (options.rpp &&
                        startIndex - startStart >= options.rpp)
                ) {
                    return undefined;
                }
            }

            const remaining = options.rpp
                ? options.rpp - (startIndex - startStart)
                : undefined;
    console.log(url, fqComponent, startIndex, remaining)
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
                blah: "blah"
            }
        ]);
    }

    getJsonFirstClassOrganization(id: string): Promise<any> {
        return Promise.resolve();
    }

    searchFirstClassOrganizationsByTitle(
        title: string,
        maxResults: number
    ): AsyncPage<any[]> {
        return AsyncPage.single([]);
    }
   
    public getJsonDatasetPublisherId(dataset: any): string {
        if (!dataset.organization) {
            return undefined;
        }
        return dataset.organization.id;
    }
    getJsonDatasetPublisher(dataset: any): Promise<any> {
        return Promise.resolve();
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
                console.log("Requesting " + requestUrl);
                request(requestUrl, { json: true }, (error, response, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    console.log("Received@" + startIndex);
                    resolve(body);
                });
            });

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
        url: uri.URI,
    ): Promise<DapPackageSearchResponse> {
        const pageUrl = url.clone();
        const operation = () =>
            new Promise<DapPackageSearchResponse>((resolve, reject) => {
                const requestUrl = pageUrl.toString();
                console.log("Requesting " + requestUrl);
                request(requestUrl, { json: true }, (error, response, body) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(body);
                });
            });

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


}
