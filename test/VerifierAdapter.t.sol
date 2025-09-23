// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import { Test } from "lib/forge-std/src/Test.sol";
import { VerifierAdapter } from "../contracts/VerifierAdapter.sol";
import { CredentialRegistry } from "../contracts/CredentialRegistry.sol";

contract VerifierAdapterTest is Test {
    CredentialRegistry registry;
    VerifierAdapter adapter;
    address verifier = address(0xBEEF);
    address issuer = address(0xABCD);
    address subject = address(0x1234);
    bytes32 schemaId = keccak256("TestSchema");

    function setUp() public {
        registry = new CredentialRegistry();
        registry.setIssuer(issuer, true);
        adapter = new VerifierAdapter(registry);
    }

    // Verifica che un verifier possa aprire una richiesta di autenticazione.
    function testOpenAuthRequest() public {
        vm.prank(verifier);
        uint256 id = adapter.openAuthRequest(schemaId, subject, 100);
    (uint256 reqId, address reqVerifier, bytes32 reqSchemaId, address reqSubject, uint64 reqDeadline, VerifierAdapter.State reqState) = adapter.requests(id);
    assertEq(reqVerifier, verifier);
    assertEq(reqSchemaId, schemaId);
    assertEq(reqSubject, subject);
    assertEq(uint8(reqState), uint8(VerifierAdapter.State.Open));
    }

    // Verifica che un indirizzo non verifier non possa aprire una richiesta di autenticazione.
    function testOpenAuthRequestFailsWithZeroTTL() public {
        vm.prank(verifier);
        vm.expectRevert("ttl=0");
        adapter.openAuthRequest(schemaId, subject, 0);
    }

    // Verifica che un verifier non possa aprire una richiesta di autenticazione.
    function testRespondWithValidCredential() public {
        vm.prank(verifier);
        uint256 reqId = adapter.openAuthRequest(schemaId, subject, 100);
        vm.prank(issuer);
        uint256 credId = registry.issueCredential(subject, schemaId, 0);
        vm.prank(subject);
        adapter.respond(reqId);
    (, , , , , VerifierAdapter.State reqState) = adapter.requests(reqId);
    assertEq(uint8(reqState), uint8(VerifierAdapter.State.Approved));
    }

    // Verifica che la risposta fallisca se non c’è un credential valido.
    function testRespondFailsIfNoCredential() public {
        vm.prank(verifier);
        uint256 reqId = adapter.openAuthRequest(schemaId, subject, 100);
        vm.prank(subject);
        vm.expectRevert("no valid credential");
        adapter.respond(reqId);
    }

    // Verifica che la risposta fallisca se il subject è sbagliato.
    function testRespondFailsIfWrongSubject() public {
        vm.prank(verifier);
        uint256 reqId = adapter.openAuthRequest(schemaId, subject, 100);
        vm.prank(issuer);
        registry.issueCredential(subject, schemaId, 0);
        address attacker = address(0xDEAD);
        vm.prank(attacker);
        vm.expectRevert("wrong subject");
        adapter.respond(reqId);
    }

    // Verifica che un verifier possa negare una richiesta di autenticazione.
    function testDenyRequest() public {
        vm.prank(verifier);
        uint256 reqId = adapter.openAuthRequest(schemaId, subject, 100);
        vm.prank(verifier);
        adapter.deny(reqId);
    (, , , , , VerifierAdapter.State reqState) = adapter.requests(reqId);
    assertEq(uint8(reqState), uint8(VerifierAdapter.State.Denied));
    }

    // Verifica che la negazione fallisca se non è il verifier.
    function testDenyRequestFailsIfNotVerifier() public {
        vm.prank(verifier);
        uint256 reqId = adapter.openAuthRequest(schemaId, subject, 100);
        address attacker = address(0xDEAD);
        vm.prank(attacker);
        vm.expectRevert("not verifier");
        adapter.deny(reqId);
    }
}
