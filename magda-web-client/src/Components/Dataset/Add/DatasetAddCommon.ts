import uuidv4 from "uuid/v4";

import { ContactPointDisplayOption } from "constants/DatasetConstants";
import {
    fetchOrganization,
    fetchRecordWithNoCache,
    doesRecordExist,
    createDataset,
    ensureAspectExists,
    createPublisher,
    updateDataset,
    deleteRecordAspect,
    Record
} from "api-clients/RegistryApis";
import { config } from "config";
import { User } from "reducers/userManagementReducer";
import { RawDataset, CkanExportAspectType } from "helpers/record";
import { autocompletePublishers } from "api-clients/SearchApis";
import ServerError from "./Errors/ServerError";

export type Distribution = {
    title: string;
    description?: string;
    issued?: string;
    modified: Date;
    license?: string;
    rights?: string;
    accessURL?: string;
    accessNotes?: string;
    downloadURL?: string;
    byteSize?: number;
    mediaType?: string;
    format?: string;

    datasetTitle?: string;
    author?: string;
    keywords?: string[];
    themes?: string[];
    temporalCoverage?: TemporalCoverage;
    spatialCoverage?: SpatialCoverage;

    similarFingerprint?: any;
    equalHash?: string;

    // --- An UUID for identify a file during the processing. array index is not a reliable id.
    id?: string;
    creationSource?: DistributionSource;
    creationMethod?: DistributionCreationMethod;
    _state: DistributionState;
    _progress?: number;
};

export enum DistributionSource {
    File,
    DatasetUrl,
    Api
}

export enum DistributionCreationMethod {
    Manual,
    Auto
}

export enum DistributionState {
    Added,
    Reading,
    Processing,
    Ready,
    Drafting,
    Deleting
}

export function distributionStateToText(state: DistributionState) {
    switch (state) {
        case DistributionState.Added:
            return "Added";
        case DistributionState.Reading:
            return "Reading";
        case DistributionState.Processing:
            return "Processing";
        case DistributionState.Ready:
            return "Ready";
        case DistributionState.Deleting:
            return "Deleting";
        default:
            return "Unknown";
    }
}

export type DatasetAutocompleteChoice = {
    existingId?: string;
    name: string;
    shouldShowTooltip?: boolean;
};

export type OrganisationAutocompleteChoice = {
    existingId?: string;
    name: string;
};

export type KeywordsLike = {
    keywords: string[];
    derived: boolean;
};

export type Dataset = {
    title: string;
    description?: string;
    issued?: Date;
    modified?: Date;
    languages?: string[];
    publisher?: OrganisationAutocompleteChoice;
    accrualPeriodicity?: string;
    themes?: KeywordsLike;
    keywords?: KeywordsLike;
    defaultLicense?: string;

    accrualPeriodicityRecurrenceRule?: string;
    ownerId?: string; // --- actual owner of the dataset; Initially set to same as `editingUserId` but can be changed to different user.
    editingUserId?: string; // --- always populate with current logged-in user id (if available)
    owningOrgUnitId?: string;
    custodianOrgUnitId?: string;
    contactPointDisplay?: string;
    landingPage?: string;
    importance?: string;
    accessLevel?: string;
    accessNotesTemp?: string;
};

export type Provenance = {
    mechanism?: string;
    sourceSystem?: string;
    derivedFrom?: DatasetAutocompleteChoice[];
    affiliatedOrganizations?: OrganisationAutocompleteChoice[];
    isOpenData?: boolean;
};

export type DatasetPublishing = {
    state: string;
    level: string;
    notesToApprover?: string;
    contactPointDisplay?: ContactPointDisplayOption;
    publishAsOpenData?: {
        [key: string]: boolean;
    };
};

export type SpatialCoverage = {
    bbox?: [number, number, number, number];
    spatialDataInputMethod?: "bbox" | "region" | "map";
    lv1Id?: string;
    lv2Id?: string;
    lv3Id?: string;
    lv4Id?: string;
    lv5Id?: string;
};

type InformationSecurity = {
    disseminationLimits?: string[];
    classification?: string;
};

export type CurrentStatusType = "CURRENT" | "SUPERSEDED" | "RETIRED";

type Currency = {
    status: CurrentStatusType;
    supersededBy?: DatasetAutocompleteChoice[];
    retireReason?: string;
};

export type State = {
    distributions: Distribution[];
    dataset: Dataset;
    datasetPublishing: DatasetPublishing;
    processing: boolean;
    spatialCoverage: SpatialCoverage;
    temporalCoverage: TemporalCoverage;
    datasetAccess: Access;
    informationSecurity: InformationSecurity;
    provenance: Provenance;
    currency: Currency;
    ckanExport: CkanExportAspectType;

    _lastModifiedDate: Date;
    _createdDate: Date;

    licenseLevel: "dataset" | "distribution";

    shouldUploadToStorageApi: boolean;

    isPublishing: boolean;
    error: Error | null;
};

export type TemporalCoverage = {
    intervals: Interval[];
};

export type Interval = {
    start?: Date;
    end?: Date;
};

type Access = {
    location?: string;
    notes?: string;
};

const DEFAULT_POLICY_ID = "object.registry.record.owner_only";
const PUBLISHED_DATASET_POLICY_ID = "object.registry.record.public";

function getInternalDatasetSourceAspectData() {
    return {
        id: "magda",
        name: "This Magda metadata creation tool",
        type: "internal",
        url: config.baseExternalUrl
    };
}

function getAccessControlAspectData(state: State) {
    const { dataset } = state;
    return {
        ownerId: dataset.editingUserId ? dataset.editingUserId : undefined,
        orgUnitOwnerId: dataset.owningOrgUnitId
            ? dataset.owningOrgUnitId
            : undefined,
        custodianOrgUnitId: dataset.custodianOrgUnitId
            ? dataset.custodianOrgUnitId
            : undefined
    };
}

function getPublishingAspectData(state: State) {
    const { datasetPublishing } = state;
    return {
        ...datasetPublishing
    };
}

function dateStringToDate(dateInput: any): Date | null {
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput;
    }
    if (!dateInput || typeof dateInput !== "string") {
        return null;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
        return null;
    }
    return d;
}

function populateDcatDatasetStringAspect(data: RawDataset, state: State) {
    const datasetDcatString = data?.aspects["dcat-dataset-strings"];
    if (!datasetDcatString) {
        return;
    }
    state.dataset = {
        ...state.dataset,
        title: datasetDcatString.title,
        description: datasetDcatString.description
    };

    if (typeof datasetDcatString?.languages === "string") {
        state.dataset.languages = [datasetDcatString.languages];
    } else if (datasetDcatString?.languages?.length) {
        state.dataset.languages = datasetDcatString.languages;
    }

    if (datasetDcatString?.accrualPeriodicity) {
        state.dataset.accrualPeriodicity = datasetDcatString.accrualPeriodicity;
    }

    if (datasetDcatString?.accrualPeriodicityRecurrenceRule) {
        state.dataset.accrualPeriodicityRecurrenceRule =
            datasetDcatString.accrualPeriodicityRecurrenceRule;
    }

    const issuedDate = dateStringToDate(datasetDcatString?.issued);
    if (issuedDate) {
        state.dataset.issued = issuedDate;
    }

    const modifiedDate = dateStringToDate(datasetDcatString?.modified);
    if (modifiedDate) {
        state.dataset.modified = modifiedDate;
    }

    if (datasetDcatString?.keywords?.length) {
        state.dataset.keywords = {
            derived: false,
            keywords: datasetDcatString?.keywords
        };
    }

    if (datasetDcatString?.themes?.length) {
        state.dataset.themes = {
            derived: false,
            keywords: datasetDcatString?.themes
        };
    }

    if (datasetDcatString?.defaultLicense) {
        state.dataset.defaultLicense = datasetDcatString?.defaultLicense;
    }

    if (data.aspects?.["dataset-access-control"]?.ownerId) {
        state.dataset.ownerId =
            data.aspects?.["dataset-access-control"]?.ownerId;
    }

    if (data.aspects?.["dataset-access-control"]?.orgUnitOwnerId) {
        state.dataset.owningOrgUnitId =
            data.aspects?.["dataset-access-control"]?.orgUnitOwnerId;
    }

    if (data.aspects?.["dataset-access-control"]?.custodianOrgUnitId) {
        state.dataset.custodianOrgUnitId =
            data.aspects?.["dataset-access-control"]?.custodianOrgUnitId;
    }
}

function populateDatasetPublisherAspect(data: RawDataset, state: State) {
    const publisher = data.aspects?.["dataset-publisher"]?.publisher;

    if (publisher) {
        state.dataset.publisher = {
            name: publisher.name,
            existingId: publisher.id
        };
    }
}

function populateTemporalCoverageAspect(data: RawDataset, state: State) {
    if (!data.aspects?.["temporal-coverage"]?.intervals?.length) {
        return;
    }
    const intervals = data.aspects["temporal-coverage"].intervals
        .map((item) => ({
            start: dateStringToDate(item.start),
            end: dateStringToDate(item.end)
        }))
        .filter((item) => item.start || item.end);

    if (intervals.length) {
        state.temporalCoverage = {
            intervals: intervals as Interval[]
        };
    }
}

async function getDatasetNameById(id): Promise<string> {
    try {
        // --- turn off cache
        const data = await fetchRecordWithNoCache(
            id,
            ["dcat-dataset-strings"],
            [],
            false
        );
        if (data?.aspects?.["dcat-dataset-strings"]?.title) {
            return data.aspects["dcat-dataset-strings"].title;
        } else {
            return data.name;
        }
    } catch (e) {
        console.log(e);
        return "";
    }
}

async function convertToDatasetAutoCompleteData(
    items: { id?: string[]; name?: string }[] | undefined
): Promise<DatasetAutocompleteChoice[] | undefined> {
    if (items?.length) {
        const result: DatasetAutocompleteChoice[] = [];
        for (let i = 0; i < items.length; i++) {
            let name = items[i]?.name;
            const id = items[i]?.id?.[0];
            if (!name && !id) {
                continue;
            }
            if (!name) {
                name = await getDatasetNameById(id);
            }
            const item: DatasetAutocompleteChoice = { name };
            if (id) {
                item.existingId = id;
            }
            result.push(item);
        }
        if (result.length) {
            return result;
        }
    }
    return;
}

async function populateProvenanceAspect(data: RawDataset, state: State) {
    if (
        !data?.aspects?.["provenance"] ||
        !Object.keys(data.aspects?.["provenance"])?.length
    ) {
        return;
    }

    const {
        derivedFrom,
        affiliatedOrganizationIds,
        ...restProps
    } = data.aspects["provenance"];

    const provenance = {
        ...restProps
    } as any;

    if (derivedFrom?.length) {
        provenance.derivedFrom = await convertToDatasetAutoCompleteData(
            derivedFrom
        );
    }

    if (affiliatedOrganizationIds?.length) {
        provenance.affiliatedOrganizations = affiliatedOrganizationIds.map(
            (item) => ({
                existingId: item.id,
                name: item?.aspects?.["organization-details"]?.title
                    ? item?.aspects?.["organization-details"]?.title
                    : item.name
            })
        );
    }

    state.provenance = provenance;
}

async function populateCurrencyAspect(data: RawDataset, state: State) {
    if (
        !data?.aspects?.["currency"] ||
        !Object.keys(data?.aspects?.["currency"])
    ) {
        return;
    }

    const { supersededBy, ...restCurrencyProps } = data.aspects["currency"];
    const currency = {
        ...restCurrencyProps,
        supersededBy: await convertToDatasetAutoCompleteData(supersededBy)
    };
    state.currency = currency;
}

function populateDistributions(data: RawDataset, state: State) {
    if (!data?.aspects?.["dataset-distributions"]?.distributions?.length) {
        return;
    }
    const distributions = data.aspects["dataset-distributions"].distributions
        .filter((item) => item?.aspects?.["dcat-distribution-strings"])
        .map((item) => {
            const modified = dateStringToDate(
                item.aspects["dcat-distribution-strings"].modified
            );
            const dis = {
                ...item.aspects["dcat-distribution-strings"],
                id: item.id,
                modified: modified ? modified : new Date(),
                _state: DistributionState.Ready
            };
            return dis;
        });
    if (distributions.length) {
        state.distributions = distributions;
    }
}

export async function rawDatasetDataToState(
    data: RawDataset,
    user: User
): Promise<State> {
    const state = createBlankState(user);

    populateDcatDatasetStringAspect(data, state);
    populateDatasetPublisherAspect(data, state);

    if (data.aspects?.["publishing"]) {
        state.datasetPublishing = data.aspects?.["publishing"];
    }

    if (data.aspects?.["spatial-coverage"]) {
        state.spatialCoverage = data.aspects?.["spatial-coverage"];
    }

    if (data.aspects?.["ckan-export"]) {
        state.ckanExport = data.aspects?.["ckan-export"];
    }

    populateTemporalCoverageAspect(data, state);

    if (data.aspects?.["access"]?.location || data.aspects?.["access"]?.note) {
        state.datasetAccess = data.aspects?.["access"];
    }

    if (data.aspects?.["information-security"]?.classification) {
        state.informationSecurity = data.aspects?.["information-security"];
    }

    populateProvenanceAspect(data, state);
    await populateCurrencyAspect(data, state);
    populateDistributions(data, state);

    state.licenseLevel = "dataset";

    if (state?.distributions?.length) {
        // --- if there is one distribution's license is different from dataset level
        // --- the state.licenseLevel should be distribution
        for (let i = 0; i < state.distributions.length; i++) {
            if (
                state.distributions[i].license !== state.dataset.defaultLicense
            ) {
                state.licenseLevel = "distribution";
                break;
            }
        }
    }

    return state;
}

export function createBlankState(user: User): State {
    return {
        distributions: [],
        processing: false,
        dataset: {
            title: "",
            languages: ["eng"],
            owningOrgUnitId: user ? user.orgUnitId : undefined,
            ownerId: user ? user.id : undefined,
            editingUserId: user ? user.id : undefined,
            defaultLicense: "No license"
        },
        datasetPublishing: {
            state: "draft",
            level: "agency",
            contactPointDisplay: "team"
        },
        spatialCoverage: {
            // Australia, Mainland
            lv1Id: "1"
        },
        temporalCoverage: {
            intervals: []
        },
        datasetAccess: {},
        informationSecurity: {},
        provenance: {},
        currency: {
            status: "CURRENT"
        },
        licenseLevel: "dataset",
        isPublishing: false,
        shouldUploadToStorageApi: false,
        error: null,
        _createdDate: new Date(),
        _lastModifiedDate: new Date(),
        ckanExport: {
            [config.defaultCkanServer]: {
                status: "withdraw",
                hasCreated: false,
                exportAttempted: false,
                exportRequired: false
            }
        }
    };
}

export async function loadStateFromLocalStorage(
    id: string,
    user: User
): Promise<State> {
    const stateString = localStorage[id];
    let state: State;
    if (stateString) {
        const dehydrated = JSON.parse(stateString);
        state = {
            ...dehydrated,
            dataset: {
                ...dehydrated.dataset,
                modified: dehydrated.modified && new Date(dehydrated.modified),
                issued: dehydrated.issued && new Date(dehydrated.issued)
            }
        };
    } else {
        state = createBlankState(user);
    }

    if (
        !state.dataset.publisher &&
        typeof config.defaultOrganizationId !== "undefined"
    ) {
        // --- we turned off cache here
        const org = await fetchOrganization(config.defaultOrganizationId, true);
        state.dataset.publisher = {
            name: org.name,
            existingId: org.id
        };
    }

    return state;
}

export async function loadStateFromRegistry(
    id: string,
    user: User
): Promise<State> {
    let record: RawDataset | undefined;
    try {
        // --- we turned off cache here
        record = await fetchRecordWithNoCache(id, ["dataset-draft"], [], false);
    } catch (e) {
        if (e! instanceof ServerError || e.statusCode !== 404) {
            // --- mute 404 error as we're gonna create blank status if can't find an existing one
            throw e;
        }
    }

    let state: State | undefined;
    if (record?.aspects?.["dataset-draft"]?.data) {
        try {
            const dehydrated = JSON.parse(record.aspects["dataset-draft"].data);
            state = {
                ...dehydrated,
                dataset: {
                    ...dehydrated.dataset,
                    modified:
                        dehydrated.modified && new Date(dehydrated.modified),
                    issued: dehydrated.issued && new Date(dehydrated.issued)
                }
            };
        } catch (e) {
            console.error(e);
        }
    }

    if (!state) {
        state = createBlankState(user);
    }

    if (
        !state.dataset.publisher &&
        typeof config.defaultOrganizationId !== "undefined"
    ) {
        // --- we turned off cache here
        const org = await fetchOrganization(config.defaultOrganizationId, true);
        state.dataset.publisher = {
            name: org.name,
            existingId: org.id
        };
    }

    return state;
}

export async function loadState(id: string, user: User): Promise<State> {
    if (config?.featureFlags?.previewAddDataset) {
        // --- in preview mode, still save to local storage
        return await loadStateFromLocalStorage(id, user);
    } else {
        return await loadStateFromRegistry(id, user);
    }
}

export function saveStateToLocalStorage(state: State, id: string) {
    state = Object.assign({}, state);
    state._lastModifiedDate = new Date();

    const dataset = JSON.stringify(state);
    localStorage[id] = dataset;
    return id;
}

export async function saveStateToRegistry(state: State, id: string) {
    state = Object.assign({}, state);
    state._lastModifiedDate = new Date();

    const dataset = JSON.stringify(state);
    const timestamp = state._lastModifiedDate.toISOString();

    let record: RawDataset | undefined;
    try {
        // --- we turned off cache here
        record = await fetchRecordWithNoCache(id, ["dataset-draft"], [], false);
    } catch (e) {
        if (e! instanceof ServerError || e.statusCode !== 404) {
            // --- mute 404 error as we're gonna create one if can't find an existing one
            throw e;
        }
    }

    const datasetDcatString = buildDcatDatasetStrings(state.dataset);

    const datasetDraftAspectData = {
        data: dataset,
        timestamp,
        dataset: {
            title: datasetDcatString?.title ? datasetDcatString.title : "",
            description: datasetDcatString?.description
                ? datasetDcatString.description
                : "",
            themes: datasetDcatString?.themes ? datasetDcatString.themes : [],
            keywords: datasetDcatString?.keywords
                ? datasetDcatString.keywords
                : []
        }
    };

    if (!record) {
        await createDataset(
            {
                id,
                name: "",
                authnReadPolicyId: DEFAULT_POLICY_ID,
                aspects: {
                    "dataset-draft": datasetDraftAspectData,
                    publishing: getPublishingAspectData(state),
                    "dataset-access-control": getAccessControlAspectData(state),
                    source: getInternalDatasetSourceAspectData()
                }
            },
            []
        );
    } else {
        if (!record?.aspects) {
            record.aspects = {} as any;
        }
        record.aspects["dataset-draft"] = datasetDraftAspectData;
        await updateDataset(record, []);
    }

    return id;
}

export async function saveState(state: State, id = createId()) {
    if (config?.featureFlags?.previewAddDataset) {
        // --- in preview mode, still save to local storage
        return saveStateToLocalStorage(state, id);
    } else {
        return await saveStateToRegistry(state, id);
    }
}

export function createId(type = "ds") {
    return `magda-${type}-${uuidv4()}`;
}

async function ensureBlankDatasetIsSavedToRegistry(
    state: State,
    id: string,
    name: string
) {
    if (!(await doesRecordExist(id))) {
        // --- if the dataset not exist in registry, save it now
        // --- the dataset should have the same visibility as the current one
        // --- but always be a draft one
        await createDataset(
            {
                id,
                name,
                authnReadPolicyId: DEFAULT_POLICY_ID,
                aspects: {
                    publishing: getPublishingAspectData(state),
                    "dataset-access-control": getAccessControlAspectData(state),
                    source: getInternalDatasetSourceAspectData()
                }
            },
            []
        );
    }
}

/**
 * Convert data produced by `DatasetAutocomplete` dropdown box to a format that can be saved to the registry.
 * If `choices` parameters is empty (or `undefined`), this function simply return `undefined`.
 * This function also create a blank dataset record in registry only if the draft dataset has not been saved to registry yet.
 *
 * @export
 * @param {State} state
 * @param {DatasetAutocompleteChoice[]} [choices]
 * @returns {(Promise<
 *     | {
 *           id?: string[];
 *           name?: string;
 *       }[]
 *     | undefined
 * >)}
 */
export async function preProcessDatasetAutocompleteChoices(
    state: State,
    choices?: DatasetAutocompleteChoice[]
): Promise<
    | {
          id?: string[];
          name?: string;
      }[]
    | undefined
> {
    if (!choices?.length) {
        return;
    }
    const result: {
        id?: string[];
        name?: string;
    }[] = [];
    for (let i = 0; i < choices.length; i++) {
        const id = choices[i]?.existingId;
        const name = choices[i]?.name;
        if (!id && !name) {
            continue;
        }
        if (id && name) {
            await ensureBlankDatasetIsSavedToRegistry(
                state,
                id as string,
                name
            );
        }
        result.push({
            id: id ? [id] : undefined,
            name: !id ? name : undefined
        });
    }
    if (!result.length) {
        return;
    }
    return result;
}

function buildDcatDatasetStrings(value: Dataset) {
    return {
        title: value.title,
        description: value.description,
        issued: value.issued && value.issued.toISOString(),
        modified: value.modified && value.modified.toISOString(),
        languages: value.languages,
        publisher: value.publisher && value.publisher.name,
        accrualPeriodicity: value.accrualPeriodicity,
        accrualPeriodicityRecurrenceRule:
            value.accrualPeriodicityRecurrenceRule,
        themes: value.themes && value.themes.keywords,
        keywords: value.keywords && value.keywords.keywords,
        defaultLicense: value.defaultLicense
    };
}

async function getOrgIdFromAutocompleteChoice(
    organization: OrganisationAutocompleteChoice
) {
    let orgId: string;
    if (!organization.existingId) {
        // Do a last check to make sure the publisher really doesn't exist
        const existingPublishers = await autocompletePublishers(
            {},
            organization.name
        );

        const match = existingPublishers.options.find(
            (publisher) =>
                publisher.value.toLowerCase().trim() ===
                organization!.name.toLowerCase().trim()
        );

        if (!match) {
            // OK no publisher, lets add it
            await ensureAspectExists("organization-details");

            orgId = uuidv4();
            await createPublisher({
                id: orgId,
                name: organization.name,
                aspects: {
                    "organization-details": {
                        name: organization.name,
                        title: organization.name,
                        imageUrl: "",
                        description: "Added manually during dataset creation"
                    }
                }
            });
        } else {
            orgId = match.identifier;
        }
    } else {
        orgId = organization.existingId;
    }

    return orgId;
}

async function convertStateToDatasetRecord(
    datasetId: string,
    distributionRecords: Record[],
    state: State,
    setState: React.Dispatch<React.SetStateAction<State>>,
    isUpdate: boolean = false,
    authnReadPolicyId?: string
) {
    const {
        dataset,
        spatialCoverage,
        temporalCoverage,
        informationSecurity,
        datasetAccess,
        provenance,
        currency,
        ckanExport
    } = state;

    let ckanExportData;
    try {
        const data = await fetchRecordWithNoCache(
            datasetId,
            [],
            ["ckan-export"],
            false
        );
        ckanExportData = data.aspects["ckan-export"];
        ckanExportData[config.defaultCkanServer].status =
            ckanExport[config.defaultCkanServer].status;
        ckanExportData[config.defaultCkanServer].exportRequired =
            ckanExport[config.defaultCkanServer].exportRequired;
    } catch (e) {
        // ckan-export aspect doesn't exist on the dataset
        ckanExportData = ckanExport;
    }

    let publisherId;
    if (dataset.publisher) {
        publisherId = await getOrgIdFromAutocompleteChoice(dataset.publisher);
        setState((state) => ({
            ...state,
            dataset: {
                ...state.dataset,
                publisher: {
                    name: (dataset.publisher as any).name,
                    publisherId
                }
            }
        }));
    }

    const authPolicy = authnReadPolicyId
        ? authnReadPolicyId
        : DEFAULT_POLICY_ID;

    const inputDataset = {
        id: datasetId,
        name: dataset.title,
        authnReadPolicyId: authPolicy,
        aspects: {
            publishing: getPublishingAspectData(state),
            "dcat-dataset-strings": buildDcatDatasetStrings(dataset),
            "spatial-coverage": spatialCoverage,
            "temporal-coverage": temporalCoverage,
            "dataset-distributions": {
                distributions: distributionRecords.map((d) => d.id)
            },
            "ckan-export": ckanExportData,
            access: datasetAccess,
            "information-security": informationSecurity,
            "dataset-access-control": getAccessControlAspectData(state),
            currency: {
                ...currency,
                supersededBy:
                    currency.status === "SUPERSEDED"
                        ? await preProcessDatasetAutocompleteChoices(
                              state,
                              currency.supersededBy
                          )
                        : undefined,
                retireReason:
                    currency.status === "RETIRED"
                        ? currency.retireReason
                        : undefined
            },
            provenance: {
                mechanism: provenance.mechanism,
                sourceSystem: provenance.sourceSystem,
                derivedFrom: await preProcessDatasetAutocompleteChoices(
                    state,
                    provenance.derivedFrom
                ),
                affiliatedOrganizationIds:
                    provenance.affiliatedOrganizations &&
                    (await Promise.all(
                        provenance.affiliatedOrganizations.map((org) =>
                            getOrgIdFromAutocompleteChoice(org)
                        )
                    )),
                isOpenData: provenance.isOpenData
            },
            "dataset-publisher": publisherId && {
                publisher: publisherId
            }
        }
    };

    if (!isUpdate) {
        inputDataset.aspects["source"] = getInternalDatasetSourceAspectData();
    }

    return inputDataset;
}

async function convertStateToDistributionRecords(
    state: State,
    authnReadPolicyId?: string
) {
    const { dataset, distributions, licenseLevel } = state;

    const authPolicy = authnReadPolicyId
        ? authnReadPolicyId
        : DEFAULT_POLICY_ID;
    const distributionRecords = distributions.map((distribution) => {
        const aspect =
            licenseLevel === "dataset"
                ? {
                      ...distribution,
                      license: dataset.defaultLicense
                  }
                : distribution;

        return {
            id: distribution.id ? distribution.id : createId("dist"),
            name: distribution.title,
            aspects: {
                "dcat-distribution-strings": aspect
            },
            authnReadPolicyId: authPolicy
        };
    });

    return distributionRecords;
}

export async function createDatasetFromState(
    datasetId: string,
    state: State,
    setState: React.Dispatch<React.SetStateAction<State>>,
    authnReadPolicyId?: string
) {
    if (state.datasetPublishing.publishAsOpenData?.dga) {
        state.ckanExport[config.defaultCkanServer].status = "retain";
        state.ckanExport[config.defaultCkanServer].exportRequired = true;
    } else {
        state.ckanExport[config.defaultCkanServer].status = "withdraw";
        state.ckanExport[config.defaultCkanServer].exportRequired = false;
    }

    const distributionRecords = await convertStateToDistributionRecords(
        state,
        authnReadPolicyId
    );
    const datasetRecord = await convertStateToDatasetRecord(
        datasetId,
        distributionRecords,
        state,
        setState,
        false,
        authnReadPolicyId
    );
    await createDataset(datasetRecord, distributionRecords);
}

export async function updateDatasetFromState(
    datasetId: string,
    state: State,
    setState: React.Dispatch<React.SetStateAction<State>>,
    authnReadPolicyId?: string
) {
    if (state.datasetPublishing.publishAsOpenData?.dga) {
        state.ckanExport[config.defaultCkanServer].status = "retain";
    } else {
        state.ckanExport[config.defaultCkanServer].status = "withdraw";
    }

    state.ckanExport[config.defaultCkanServer].exportRequired = true;

    const distributionRecords = await convertStateToDistributionRecords(
        state,
        authnReadPolicyId
    );
    const datasetRecord = await convertStateToDatasetRecord(
        datasetId,
        distributionRecords,
        state,
        setState,
        true,
        authnReadPolicyId
    );
    await updateDataset(datasetRecord, distributionRecords);
}

/**
 * This function will submit the dataset using different API endpoints (depends on whether the dataset has been create or not)
 * It will also delete any temporary draft data from the `dataset-draft` aspect.
 *
 * @export
 * @param {string} datasetId
 * @param {State} state
 * @param {React.Dispatch<React.SetStateAction<State>>} setState
 */
export async function submitDatasetFromState(
    datasetId: string,
    state: State,
    setState: React.Dispatch<React.SetStateAction<State>>
) {
    if (await doesRecordExist(datasetId)) {
        await updateDatasetFromState(
            datasetId,
            state,
            setState,
            PUBLISHED_DATASET_POLICY_ID
        );
    } else {
        await createDatasetFromState(
            datasetId,
            state,
            setState,
            PUBLISHED_DATASET_POLICY_ID
        );
    }

    await deleteRecordAspect(datasetId, "dataset-draft");
}
