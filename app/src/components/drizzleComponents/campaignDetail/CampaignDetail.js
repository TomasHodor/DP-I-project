import React from "react";
import {Alert, Badge, Button, Card, Col, Container, Form, ProgressBar, Table} from "react-bootstrap";
import web3 from "../../../web3Instance"
import Web3 from "web3";
import CrowdfundingCampaign from "../../../contracts/CrowdfundingCampaign.json";
import ConfirmModal from "../../confirmModal/ConfirmModal";
import {renderEtherValue} from "../../utils";
import nodejs_connection from "../../../nodejsInstance";
import LoadingModal from "../../loadingModal/LoadingModal";

class CampaignDetail extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            confirmModal: false,
            loadingModal: false,
            confirmModalText: '',
            value: '',
            description: '',
            etherValue: 'wei',
            totalValue: 0,
            goalValue: 1000000,
            contributions: [],
            contributionsCheckBoxs: [],
            campaignStatus: null,
            campaignAddress: this.props.address,
            campaignOwnerAddress: null,
            campaignOwner: null,
            campaignOwnerMail: null,
            campaignId: null,
            campaignDescription: null,
            user: this.props.user,
            error: null,
            gas: null,
            finishButton: false,
            cancelButton: false,
            withdrawButton: false,
            contributeButton: false
        };
    }

    async getCampaignValue(valueType) {
        const crowdfundingCampaignMethods = this.props.drizzle.contracts[this.props.name].methods;
        let valueTypeFunc = await crowdfundingCampaignMethods[valueType].call();
        return await valueTypeFunc.call();
    }

    async componentDidMount() {
        if (!(this.props.name in this.props.drizzle.contracts)) {
            let web3Contract = new web3.eth.Contract(CrowdfundingCampaign.abi, this.props.address);
            let events = ["logContractBalance", "logContributeMoney", "logContributions2length"];
            this.props.drizzle.addContract({ contractName: this.props.name, web3Contract: web3Contract}, events);
        }

        let campaignStatus = await this.getCampaignValue("campaignStatus");
        let totalValue = await this.getCampaignValue("totalValue");
        let goalValue = await this.getCampaignValue("goalValue");
        let campaignOwnerAddress = await this.getCampaignValue("ownerAddress");
        this.setState({
            campaignStatus: campaignStatus,
            totalValue: parseInt(totalValue),
            goalValue: parseInt(goalValue),
            campaignOwnerAddress: campaignOwnerAddress
        })
        let campaignRawRespond = await fetch(nodejs_connection + '/campaign/address=' + this.props.address, {
            method: 'GET', headers: {'Content-Type': 'application/json'}
        });
        let campaignRespond = await campaignRawRespond.json();
        if (campaignRespond) {
            this.setState({
                campaignOwner: campaignRespond[0].owner,
                campaignId: campaignRespond[0].campaign_id,
                campaignDescription: campaignRespond[0].description,
                campaignOwnerMail: campaignRespond[0].email
            })
        }

        if (this.state.user) {
            const crowdfundingCampaignMethods = this.props.drizzle.contracts[this.props.name].methods;
            let apiResponse = null;
            if (this.state.user.user_id === this.state.campaignOwner) {
                let jsonResponse = []
                try {
                    let contributors_size = await(await crowdfundingCampaignMethods.getNumberOfContributors()).call();
                    for (let i = 0; i < contributors_size; i++) {
                        let contributor_address = await (await crowdfundingCampaignMethods.contributors(i)).call();
                        let contributions_size = await (await crowdfundingCampaignMethods.getNumberOfAddressContribution(contributor_address)).call();
                        for (let j = 0; j < contributions_size; j++) {
                            let contribution = await (await crowdfundingCampaignMethods.contributions(contributor_address, j)).call();
                            jsonResponse.push({
                                "from": contributor_address,
                                "value": contribution.value,
                                "text": contribution.description
                            })
                        }
                    }
                }
                catch(ex) {
                    console.log(ex);
                }
                this.setState({ contributions: jsonResponse })
            } else {
                apiResponse = await fetch(nodejs_connection + '/contribution/contributor=' + this.state.user.user_id
                    + "&campaign=" + this.state.campaignId, {
                    method: 'GET',
                    headers: {'Content-Type': 'application/json'}
                });
                let jsonResponse = await apiResponse.json();
                for (let i = 0; i < jsonResponse.length; i++) {
                    if (jsonResponse[i].hash) {
                        try {
                            let trans = await web3.eth.getTransaction(jsonResponse[i].hash);
                            if (trans) {
                                jsonResponse[i]["value"] = trans.value;
                                jsonResponse[i]["from"] = trans.from;
                            }
                            let contribution = await(await crowdfundingCampaignMethods.contributions(trans.from, i)).call();
                            if (contribution) {
                                jsonResponse[i]["text"] = contribution.description;
                            }
                        }
                        catch(ex) {
                            console.log(ex);
                        }
                    }
                }
                this.setState({ contributions: jsonResponse })
            }
        }
    }

    contributeButton(e) {
        e.preventDefault();
        if (this.state.value === ""){
            this.setState({ error: "Empty value" })
            return;
        }
        if (typeof window.ethereum === 'undefined') {
            console.log('MetaMask is missing!');
            this.setState({ error: 'MetaMask is missing' })
            return;
        }
        this.setState({
            error: '',
            confirmModal: true,
            contributeButton: true,
            confirmModalText: "Do you want to contribute to this campaign?"});
    }

    async contributeCampaign() {
        this.setState({loadingModal: true})
        const accounts = await window.ethereum.request({method: 'eth_requestAccounts'});
        if (accounts.length === 0) {
            this.setState({ error: 'No MetaMask accounts' });
            return;
        }
        const account = accounts[0];
        const crowdfundingCampaign = this.props.drizzle.contracts[this.props.name];
        let contributeFunction = await crowdfundingCampaign.methods.contributeCampaign(this.state.description);
        let contributeGas = await crowdfundingCampaign.methods.contributeCampaign(this.state.description).estimateGas();
        console.log(contributeGas);
        let contributeResult = await contributeFunction.call();
        if (contributeResult) {
            try {
                let contributeSendResult = await contributeFunction.send({
                    from: account, gas: 1000000,
                    value: Web3.utils.toWei(this.state.value, this.state.etherValue)
                })
                console.log(contributeSendResult);
                let postResponse = await fetch(nodejs_connection + '/contribution', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        campaign: this.state.campaignId,
                        contributor: this.state.user.user_id,
                        hash: contributeSendResult.transactionHash
                    })
                });
                let jsonResponse = await postResponse.json();
                let contributions = this.state.contributions;
                contributions.push({
                    contribution_id: jsonResponse.contribution_id,
                    campaign: this.state.campaignId,
                    contributor: this.state.user.user_id,
                    hash: contributeSendResult.transactionHash,
                    value: Web3.utils.toWei(this.state.value, this.state.etherValue),
                    text: this.state.description,
                    from: account
                })
                this.setState({
                    contributions: contributions,
                    value: '', description: '',
                    totalValue: parseInt(this.state.totalValue) + parseInt(Web3.utils.toWei(this.state.value, this.state.etherValue)),
                    gas: contributeSendResult.gasUsed,
                    confirmModal: false,
                    contributeButton: false,
                    loadingModal: false
                })
            } catch (error) {
                console.log(error)
                if ("message" in error)
                    this.setState({ error: error.message, loadingModal: false, confirmModal: false })
                else
                    this.setState({ error: error.toString(), loadingModal: false, confirmModal: false })
            }
        }
    }

    finishCampaignButton(e) {
        e.preventDefault();
        if (this.state.totalValue < this.state.goalValue) {
            this.setState({error: "Can not finish this campaign. Not enough value was funded"})
            return;
        }
        this.setState({
            error: '',
            confirmModal: true,
            finishButton: true,
            confirmModalText: "Do you want to finish this campaign ?"});
    }

    async finishCampaign() {
        this.setState({loadingModal: true})
        const crowdfundingCampaign = this.props.drizzle.contracts[this.props.name];
        let finishCampaignFunction = await crowdfundingCampaign.methods.finishCampaign()
        let finishCampaignResult = await finishCampaignFunction.call();
        if (finishCampaignResult) {
            try {
                await finishCampaignFunction.send({
                    gas: 1000000, from: this.state.campaignOwnerAddress
                });
                let campaignStatus = await this.getCampaignValue("campaignStatus");
                this.setState({ campaignStatus: campaignStatus, confirmModal: false, finishButton: false, loadingModal: false });
            } catch (error) {
                console.log(error)
                if ("message" in error)
                    this.setState({ error: error.message, loadingModal: false, confirmModal: false })
                else
                    this.setState({ error: error.toString(), loadingModal: false, confirmModal: false })
            }
        }

    }

    cancelCampaignButton(e) {
        e.preventDefault();
        this.setState({
            error: '',
            confirmModal: true,
            cancelButton: true,
            confirmModalText: "Do you want to cancel this campaign ?" });
    }

    async cancelCampaign() {
        const crowdfundingCampaign = this.props.drizzle.contracts[this.props.name];
        let cancelCampaignFunction = await crowdfundingCampaign.methods.cancelCampaign();
        let cancelCampaignResult = await cancelCampaignFunction.call();
        console.log(cancelCampaignResult);
        if (cancelCampaignResult) {
            try {
                await cancelCampaignFunction.send({
                    gas: 1000000, from: this.state.campaignOwnerAddress
                });
                let campaignStatus = await this.getCampaignValue("campaignStatus");
                this.setState({
                    campaignStatus: campaignStatus, confirmModal: false, cancelButton: false
                });
            } catch (error) {
                console.log(error)
                if ("message" in error)
                    this.setState({ error: error.message, loadingModal: false, confirmModal: false })
                else
                    this.setState({ error: error.toString(), loadingModal: false, confirmModal: false })
            }
        }

    }

    withdrawContributionButton(e) {
        e.preventDefault();
        this.setState({
            error: '',
            confirmModal: true,
            withdrawButton: true,
            confirmModalText: "Do you want to witdhraw from this campaign ?" });
    }

    async withdrawContribution() {
        const crowdfundingCampaign = this.props.drizzle.contracts[this.props.name];
        let contributionsCheckBoxs = this.state.contributionsCheckBoxs;
        let contributions = this.state.contributions;
        for (let i = 0; i < contributionsCheckBoxs.length; i++) {
            try {
                let withdrawContributionFunction = await crowdfundingCampaign.methods.withdrawContribution(contributionsCheckBoxs[i]).send({
                    gas: 1000000, from: contributions[contributionsCheckBoxs[i]].from
                });
                console.log(withdrawContributionFunction)
            } catch (error) {
                console.log(error)
                if ("message" in error)
                    this.setState({ error: error.message, loadingModal: false, confirmModal: false })
                else
                    this.setState({ error: error.toString(), loadingModal: false, confirmModal: false })
                break
            }
            let deleteResponse = await fetch(nodejs_connection + '/contribution/contribution_id=' + contributions[contributionsCheckBoxs[i]].contribution_id, {
                method: 'DELETE', headers: {'Content-Type': 'application/json'}
            })
            console.log(deleteResponse);
            contributions.splice(contributionsCheckBoxs[i], 1);
        }
        let totalValue = await this.getCampaignValue("totalValue");

        this.setState({
            contributions: contributions,
            totalValue: parseInt(totalValue),
            contributionsCheckBoxs: [],
            confirmModal: false,
            withdrawButton: false
        })
    }

    async openConfirmModal() {
        if (this.state.finishButton) await this.finishCampaign();
        if (this.state.cancelButton) await this.cancelCampaign();
        if (this.state.contributeButton) await this.contributeCampaign();
        if (this.state.withdrawButton) await this.withdrawContribution();
    }

    closeConfirmModal() {
        this.setState({confirmModal: false});
    }

    handleOnChange(i) {
        let contributionsCheckBoxs = this.state.contributionsCheckBoxs;
        if (contributionsCheckBoxs.includes(i)){
            contributionsCheckBoxs = contributionsCheckBoxs.filter((e) => {return e !== i });
        } else {
            contributionsCheckBoxs.push(i);
        }
        this.setState({ contributionsCheckBoxs: contributionsCheckBoxs.sort().reverse() });
    }

    showContributions() {
        let output = [];
        let dataset = this.state.contributions;
        for (let i = 0; i < dataset.length; i++) {
            if (this.state.user.user_id === this.state.campaignOwner) {
                output.push(
                    <tr key={'row-' + i} id={'row-' + i}>
                        <td>{ dataset[i].from }</td>
                        <td>{ dataset[i].text }</td>
                        <td>{ renderEtherValue(dataset[i].value) }</td>
                    </tr>)
            } else {
                output.push(
                    <tr key={'row-' + i} id={'row-' + i}>
                        <td><Form.Check type={'checkbox'} id={'row-' + i}
                                        checked={this.state.contributionsCheckBoxs.includes(i)}
                                        onChange={() => this.handleOnChange(i)}/></td>
                        <td>{ dataset[i].from }</td>
                        <td>{ dataset[i].text }</td>
                        <td>{ renderEtherValue(dataset[i].value) }</td>
                    </tr>)
            }
        }
        return output;
    }

    render() {

        const confirmModal = this.state.confirmModal ? (
            <ConfirmModal
                show={this.state.confirmModal}
                confirm={this.openConfirmModal.bind(this)}
                cancel={this.closeConfirmModal.bind(this)}
                text={this.state.confirmModalText}
            />
        ) : null;
        const loadingModal = this.state.loadingModal ? <LoadingModal show={this.state.loadingModal}/> : null;
        const contributeForm = this.state.campaignStatus && this.state.user && this.state.campaignOwner !== this.state.user.user_id ?
            <Form id="contribute" className="mt-3" onSubmit={this.contributeButton.bind(this)}>
                <Form.Group className="mb-3 row" controlId="formBasicValue">
                    <Col md={6}>
                        <Form.Control type="number" placeholder="Enter value" value={this.state.value}
                            onChange={(e) => this.setState({value: e.target.value})}/>
                    </Col>
                    <Col md={3}>
                        <Form.Select onChange={(e) => this.setState({etherValue: e.target.value})}>
                            <option value="wei">Wei</option>
                            <option value="gwei">Gwei</option>
                            <option value="ether">Ether</option>
                        </Form.Select>
                    </Col>
                </Form.Group>
                <Form.Group className="mb-3" controlId="formBasicDetail">
                    <Form.Control type="text" placeholder="Enter description" value={this.state.description}
                        onChange={(e) => this.setState({description: e.target.value})}/>
                </Form.Group>
                <div className="d-grid">
                    <Button variant="dark" type="submit">Contribute</Button>
                </div>
            </Form> : null

        let progress = (this.state.totalValue / this.state.goalValue * 100).toFixed(2)

        const contributionsWallet = this.state.user && this.state.contributions.length && this.state.campaignStatus
            ? this.state.campaignOwner === this.state.user.user_id  ?
                <Table className="mt-2" striped bordered hover size="sm">
                    <thead><tr><th>address</th><th>text</th><th>value</th></tr></thead>
                    <tbody>{this.showContributions()}</tbody>
                </Table> :
            <Form id="withdraw" onSubmit={this.withdrawContributionButton.bind(this)}>
                <Table className="mt-2 mb-2" striped bordered hover size="sm">
                    <thead><tr><th/><th>address</th><th>text</th><th>value</th></tr></thead>
                    <tbody>{this.showContributions()}</tbody>
                </Table>
                <Button variant="outline-dark" type="submit">Withdraw Contribution</Button>
            </Form> : null
        return (
            <Container>
                {loadingModal}
                {confirmModal}
                <p><strong>Address: </strong>{ this.state.campaignAddress }</p>
                <p><strong>Status: </strong>{
                    this.state.campaignStatus === "active" ? <Badge pill bg="primary">Active</Badge> :
                    this.state.campaignStatus === "finished" ? <Badge pill bg="success">Successful</Badge> :
                        <Badge pill bg="danger">Canceled</Badge> }</p>
                <p><strong>Owner: </strong>{ this.state.campaignOwnerMail }<br/>
                    {this.state.campaignOwnerAddress}</p>
                <p><strong>Total Value: </strong>{ renderEtherValue(this.state.totalValue) }</p>
                <p><strong>Pledged Goal: </strong>{ renderEtherValue(this.state.goalValue) }</p>
                <Card>
                    <Card.Body>
                        <Card.Title>Description</Card.Title>
                        <Card.Text>{ this.state.campaignDescription}</Card.Text>
                    </Card.Body>
                </Card>
                { this.state.totalValue < this.state.goalValue ?
                    <ProgressBar variant="primary" className="mt-2" now={parseFloat(progress)} label={`${progress}%`} /> :
                    <ProgressBar variant="success" className="mt-2" now={parseFloat(progress)} label={`${progress}%`} /> }
                {contributeForm}
                {this.state.gas ? <Alert variant='primary' className="mt-2 mb-2">Used Gas: {this.state.gas}</Alert> : null}
                { this.state.user && this.state.campaignOwner === this.state.user.user_id ?
                    <>
                        <Button variant="outline-dark" className="mt-3 me-3"
                                disabled={this.state.campaignStatus === "canceled" || this.state.campaignStatus === "finished"}
                                onClick={this.finishCampaignButton.bind(this)} >Finish Campaign</Button>
                        <Button variant="dark" className="mt-3 me-3"
                                disabled={this.state.campaignStatus === "canceled" || this.state.campaignStatus === "finished"}
                                onClick={this.cancelCampaignButton.bind(this)}>Cancel Campaign</Button>
                    </> : null }
                {contributionsWallet}
                <br/>
                {this.state.error ? <Alert variant='danger'>{this.state.error}</Alert> : null}
            </Container>
        )
    }
}

export default CampaignDetail;

